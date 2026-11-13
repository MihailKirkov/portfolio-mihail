"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ShaderCoreProps } from "@/components/core/shader-core";
import { canRunWebGL } from "@/lib/core/gate";
import { onScroll } from "@/lib/scroll";
import { statusOf, useAgentState, type AgentStatus } from "@/lib/agent/store";

// The core's gate and its travel. `children` is the static still
// (components/core/core-still.tsx), server-rendered: the placeholder and the
// permanent fallback. On the client the gate loads the shader core (three in
// its own chunk) only when it will run well:
//   - not under reduced motion, not with hardwareConcurrency <= 4, not with
//     data saver on, not without a hardware-backed WebGL2 context
//   - not while the core is hidden (phones): nothing is fetched until it shows
// The chunk is fetched right after hydration. If it lands before the
// boot intro starts, the live core mounts hidden and the intro waits for its
// first frame (bounded, see boot-intro.tsx), so the media cursor drops in a
// core that is already turning. If it lands while the intro is running, the
// mount waits for the intro to end: a context + shader compile stalls a
// frame, which would show as a cursor jump. Then the still is dropped in and
// the live core crossfades in afterwards. The stack reports this on
// data-core ("loading" | "deferred") and data-core-ready.
// Once the shader core has drawn its first frame the still fades out under
// it (same camera, same geometry: no change of shape). If the WebGL context
// is lost the still comes back and stays.
//
// Travel. One target: the hero box when the command bar is in the hero, the
// dock's slot ([data-core-slot="dock"]) once the bar has docked, or an
// in-page spot (contact, the experience timeline) while its section claims
// the core (coreSpot in the store; components/core/core-slot.tsx). An
// in-page spot moves with the page, so at rest there the core tracks it on
// every scroll instead of easing. The stack - still
// or canvas, the same element - eases toward that target every frame, so a
// reversal mid-flight only changes direction. While it flies it keeps its
// layout size (the canvas render size) and moves and scales as a whole; the
// render size changes only at rest: the slot's size when docked, the hero's
// when flying back. R3F measures the canvas by offset size, so the flight's
// transform never triggers a re-measure. Docked, it follows the slot through
// bar resizes (answer text, tool log, "Show me"), window resizes and the
// mobile keyboard. A fast scroll skips the flight: a short crossfade to the
// target instead. The still's thinking and executing looks are a CSS
// recolour keyed on data-status.
//
// Dev only: ?state=idle|thinking|executing holds the core in one state.

type ShaderModule = { ShaderCore: (p: ShaderCoreProps) => React.JSX.Element };

const DEV = process.env.NODE_ENV === "development";
const DOCKED_FPS = 24;
/** while the boot intro runs the core is a backdrop: steady and cheap */
const INTRO_FPS = 30;
/** easing rate of the flight, per second; ~0.6s for a hero-to-dock trip */
const EASE = 10;
/** settled when this close to the target, in px (position + size) */
const SETTLE_PX = 0.5;
/** the exponential ease never quite arrives: close at least this fast, px/s */
const MIN_CLOSE_PX_S = 60;
/** scrolling faster than this skips the flight for a crossfade */
const FAST_SCROLL_PX_S = 4000;
const CROSSFADE_MS = 160;

function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * run `fn` once the boot intro is out of the way: now, unless it is in the
 * given state(s), then when its attribute goes
 */
function outsideIntro(states: string[], fn: () => void): () => void {
  const html = document.documentElement;
  const intro = html.dataset.intro;
  if (!intro || !states.includes(intro)) {
    fn();
    return () => {};
  }
  const mo = new MutationObserver(() => {
    if (html.hasAttribute("data-intro")) return;
    mo.disconnect();
    fn();
  });
  mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
  return () => mo.disconnect();
}

/** a square box in viewport px */
interface Box {
  x: number;
  y: number;
  w: number;
}

function boxOf(n: Element | null | undefined): Box | null {
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width };
}

/**
 * the page's scroll speed, px/s, averaged over the last SPEED_WINDOW_MS of
 * scroll events (one event carries a whole frame's steps, so a single event
 * says little)
 */
const SPEED_WINDOW_MS = 150;
const SPEED_FLOOR_MS = 100;
function scrollSpeedTracker() {
  const samples: { t: number; y: number }[] = [];
  // the page's one scroll source (Lenis when it runs, else native)
  const stop = onScroll(({ y }) => {
    const now = performance.now();
    samples.push({ t: now, y });
    // keep one sample older than the window as the baseline, so the average
    // spans the whole window even when frames (and so events) are sparse
    while (samples.length > 2 && now - samples[1].t > SPEED_WINDOW_MS) samples.shift();
  });
  return {
    speed: () => {
      const now = performance.now();
      const last = samples[samples.length - 1];
      if (!last || now - last.t > SPEED_WINDOW_MS) return 0;
      const first = samples[0];
      // over at least SPEED_FLOOR_MS: a burst of events in one frame, or one
      // big step after a quiet spell, is not a fast scroll
      const dt = Math.max(last.t - first.t, SPEED_FLOOR_MS);
      return (Math.abs(last.y - first.y) / dt) * 1000;
    },
    stop,
  };
}

type Mode = "home" | "flying" | "docked";

export function Core({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [ready, setReady] = useState(false);
  const [stillGone, setStillGone] = useState(false);
  const [lost, setLost] = useState(false);
  const [active, setActive] = useState(true);
  const [introRunning, setIntroRunning] = useState(false);
  const [pointer, setPointer] = useState(false);
  const [forced, setForced] = useState<AgentStatus | null>(null);
  const status = useAgentState(statusOf);
  const docked = useAgentState((s) => s.docked);
  const dockedRef = useRef(docked);
  dockedRef.current = docked;
  const spot = useAgentState((s) => s.coreSpot);
  const spotRef = useRef(spot);
  spotRef.current = spot;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const retarget = useRef<() => void>(() => {});

  // decide and load at idle; mount outside a running intro
  useEffect(() => {
    const el = wrap.current;
    if (!el || !canRunWebGL()) return;
    if (DEV) {
      const s = new URLSearchParams(location.search).get("state");
      if (s === "idle" || s === "thinking" || s === "executing") setForced(s);
    }
    setPointer(finePointer());

    let disposed = false;
    let undo = () => {};
    const shown = () => el.getBoundingClientRect().width > 0;
    const load = () => {
      el.dataset.core = "loading";
      void import("@/components/core/shader-core").then((m) => {
        if (disposed) return;
        if (document.documentElement.dataset.intro === "running") el.dataset.core = "deferred";
        undo = outsideIntro(["running"], () => {
          if (disposed) return;
          setMod(m);
        });
      });
    };
    const onResize = () => {
      if (!shown()) return;
      window.removeEventListener("resize", onResize);
      load();
    };
    // right after hydration: the fetch is cheap to start, and the earlier
    // the chunk is in, the surer it is evaluated before the intro moves
    // (requestIdleCallback came too late: its evaluation landed mid-intro)
    if (shown()) load();
    // hidden (phones): fetch nothing unless a resize shows it
    else window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      undo();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // render only on screen and in a visible tab. During the boot intro the
  // first frame (the compile) must come before it starts; once it runs, the
  // core renders only after the media cursor has dropped it in
  // (data-core-shown on the wrapper, set by boot-intro.tsx), and never
  // compiles mid-intro
  useEffect(() => {
    const el = wrap.current;
    const home = el?.parentElement;
    if (!mod || !el || !home) return;
    const html = document.documentElement;
    let inView = true;
    let visible = document.visibilityState !== "hidden";
    const update = () => {
      const running = html.dataset.intro === "running";
      setIntroRunning(running);
      setActive(inView && visible && (!running || (readyRef.current && "coreShown" in home.dataset)));
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const mo = new MutationObserver(update);
    mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    mo.observe(home, { attributes: true, attributeFilter: ["data-core-shown"] });
    update();
    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mod]);

  // the still fades out under the first shader frame, then unmounts. Not
  // during the boot intro: the fade's end and the unmount each repaint the
  // hero for a frame, which mid-flight shows as a cursor jump; nothing is
  // visible yet anyway, so the still is hidden at once (globals.css) and
  // unmounted once the intro is over
  useEffect(() => {
    const el = wrap.current;
    if (!ready) {
      setStillGone(false);
      return;
    }
    if (el) delete el.dataset.core;
    let timer = 0;
    const stop = outsideIntro(["pending", "running"], () => {
      timer = window.setTimeout(() => setStillGone(true), 600);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [ready]);

  // travel: ease toward the one target every frame
  useEffect(() => {
    const el = wrap.current;
    const home = el?.parentElement;
    if (!el || !home) return;
    const slot = () =>
      document.querySelector<HTMLElement>(`[data-core-slot="${spotRef.current}"]`) ??
      document.querySelector<HTMLElement>('[data-core-slot="dock"]');
    const target = (): Box | null => (dockedRef.current ? boxOf(slot()) : boxOf(home));
    const scroll = scrollSpeedTracker();

    let mode: Mode = "home";
    /** where the stack is now, while flying or docked */
    let cur: Box | null = null;
    /** the layout size, which is the canvas render size */
    let layoutW = 0;
    let raf = 0;
    let last = 0;
    let fade = 0;
    let followers: (() => void)[] = [];

    const setLayout = (w: number) => {
      layoutW = w;
      el.style.width = `${w}px`;
      el.style.height = `${w}px`;
    };
    const apply = () => {
      if (!cur) return;
      el.style.transform = `translate(${cur.x}px, ${cur.y}px) scale(${cur.w / layoutW})`;
    };
    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const unfollow = () => {
      followers.forEach((f) => f());
      followers = [];
    };

    const settleHome = () => {
      stopLoop();
      unfollow();
      mode = "home";
      cur = null;
      el.style.width = el.style.height = el.style.transform = "";
      delete el.dataset.flying;
      delete el.dataset.docked;
    };

    const settleDock = (t: Box) => {
      stopLoop();
      unfollow();
      mode = "docked";
      cur = t;
      // at rest in the slot: render at the slot's size
      setLayout(t.w);
      apply();
      delete el.dataset.flying;
      el.dataset.docked = "";
      // follow the slot: bar resizes, window resizes, the mobile keyboard,
      // and the bar's own slide-in, which the observers do not see
      const resync = () => {
        const n = target();
        if (!n || !cur || mode !== "docked") return;
        if (Math.abs(n.x - cur.x) + Math.abs(n.y - cur.y) + Math.abs(n.w - cur.w) > SETTLE_PX) fly();
      };
      const bar = slot()?.closest<HTMLElement>(".dock-inner") ?? slot();
      const ro = bar ? new ResizeObserver(resync) : null;
      if (bar) ro?.observe(bar);
      const vv = window.visualViewport;
      const dock = slot()?.closest<HTMLElement>(".dock") ?? null;
      window.addEventListener("resize", resync);
      vv?.addEventListener("resize", resync);
      vv?.addEventListener("scroll", resync);
      dock?.addEventListener("transitionend", resync);
      const late = window.setTimeout(resync, 300);
      // a dialog closing (gallery viewer, detail overlay) unlocks the page:
      // the scrollbar and a phone's toolbars come back after the close event
      // and move the slot without resizing the bar, so check again once
      // they have settled. `close` does not bubble: listen in capture.
      let after: number[] = [];
      const onDialogClose = () => {
        after.forEach(clearTimeout);
        resync();
        after = [120, 400, 800].map((ms) => window.setTimeout(resync, ms));
      };
      document.addEventListener("close", onDialogClose, true);
      // an in-page spot scrolls with the page: track it exactly, no easing
      const inPage = !slot()?.closest(".dock");
      const track = () => {
        const n = target();
        if (!n || mode !== "docked") return;
        cur = n;
        apply();
      };
      if (inPage) window.addEventListener("scroll", track, { passive: true });
      followers = [
        () => window.removeEventListener("scroll", track),
        () => document.removeEventListener("close", onDialogClose, true),
        () => after.forEach(clearTimeout),
        () => ro?.disconnect(),
        () => window.removeEventListener("resize", resync),
        () => vv?.removeEventListener("resize", resync),
        () => vv?.removeEventListener("scroll", resync),
        () => dock?.removeEventListener("transitionend", resync),
        () => clearTimeout(late),
      ];
    };

    const settle = () => {
      const t = target();
      if (dockedRef.current && t) settleDock(t);
      else settleHome();
    };

    const tick = (now: number) => {
      raf = 0;
      const t = target();
      if (!t || !cur) return settle();
      const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 0.05);
      last = now;
      const gap = Math.abs(t.x - cur.x) + Math.abs(t.y - cur.y) + Math.abs(t.w - cur.w);
      const k = Math.min(1, Math.max(1 - Math.exp(-dt * EASE), (dt * MIN_CLOSE_PX_S) / Math.max(gap, 1e-6)));
      cur.x += (t.x - cur.x) * k;
      cur.y += (t.y - cur.y) * k;
      cur.w += (t.w - cur.w) * k;
      const left = Math.abs(t.x - cur.x) + Math.abs(t.y - cur.y) + Math.abs(t.w - cur.w);
      if (left < SETTLE_PX) {
        cur = t;
        apply();
        return settle();
      }
      apply();
      raf = requestAnimationFrame(tick);
    };

    /** head for the target from wherever the stack is now */
    const fly = () => {
      unfollow();
      if (mode === "home") {
        const h = boxOf(home);
        if (!h) return;
        cur = h;
        setLayout(h.w);
      } else if (mode === "docked" && !dockedRef.current) {
        // off home: render at the hero's size from take-off, so the way
        // back is sharp; the one re-measure happens at rest, not mid-flight
        const h = boxOf(home);
        if (h && h.w > 0) setLayout(h.w);
      }
      mode = "flying";
      el.dataset.flying = "";
      delete el.dataset.docked;
      apply();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    /** no flight: a short crossfade to the target */
    const jump = () => {
      stopLoop();
      unfollow();
      clearTimeout(fade);
      el.style.opacity = "0";
      // going home: take the hero's render size now, out of sight, so the
      // re-measure is done before the fade-in
      if (mode === "docked" && !dockedRef.current) {
        const h = boxOf(home);
        if (h && h.w > 0) {
          setLayout(h.w);
          apply();
        }
      }
      fade = window.setTimeout(() => {
        const t = target();
        if (dockedRef.current && t) {
          if (mode === "home") el.dataset.flying = "";
          settleDock(t);
        } else {
          settleHome();
        }
        el.style.opacity = "";
      }, CROSSFADE_MS);
    };

    retarget.current = () => {
      clearTimeout(fade);
      el.style.opacity = "";
      const h = boxOf(home);
      const s = boxOf(slot());
      const degenerate = !h || h.w < 1 || !s || s.w < 1;
      const speed = scroll.speed();
      const crossfade = degenerate || speed > FAST_SCROLL_PX_S;
      // how the last retarget travelled, and why (the browser checks read it)
      el.dataset.travel = crossfade ? "fade" : "fly";
      el.dataset.travelSpeed = String(Math.round(speed));
      if (crossfade) jump();
      else fly();
    };

    return () => {
      stopLoop();
      unfollow();
      clearTimeout(fade);
      scroll.stop();
      retarget.current = () => {};
    };
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (!docked && spot === "dock") return;
    }
    retarget.current();
  }, [docked, spot]);

  const gl = mod && !lost;
  return (
    <div
      className="core-stack"
      ref={wrap}
      data-status={forced ?? status}
      data-core-ready={ready && gl ? "" : undefined}
    >
      {!(stillGone && gl) && children}
      {gl && (
        <mod.ShaderCore
          status={forced ?? status}
          pointer={pointer}
          active={active}
          fps={introRunning ? INTRO_FPS : docked ? DOCKED_FPS : 0}
          onReady={() => setReady(true)}
          onLost={() => {
            setLost(true);
            setReady(false);
          }}
        />
      )}
    </div>
  );
}

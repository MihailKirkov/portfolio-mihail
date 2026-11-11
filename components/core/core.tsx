"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ShaderCoreProps } from "@/components/core/shader-core";
import { prefersReducedMotion } from "@/lib/agent/choreo";
import { statusOf, useAgentState, type AgentStatus } from "@/lib/agent/store";

// The core's gate and its travel. `children` is the static still
// (components/core/core-still.tsx), server-rendered: the placeholder and the
// permanent fallback. On the client the gate loads the shader core (three in
// its own chunk) only when it will run well:
//   - not under reduced motion, not with hardwareConcurrency <= 4, not with
//     data saver on, not without a hardware-backed WebGL2 context
//   - not while the core is hidden (phones): nothing is fetched until it shows
//   - never during the boot intro: the context and shader compile stall a
//     frame, and R3F creates them a few frames after the mount, so while the
//     intro is pending or running the mount waits for it to end. On a first
//     visit the media cursor drops in the still and the live core crossfades
//     in over it once the intro is done.
// Once the shader core has drawn its first frame the still fades out under
// it (same camera, same geometry: no change of shape). If the WebGL context
// is lost the still comes back and stays.
//
// Docking: when the command bar docks (the hero panel has scrolled away) the
// stack - still or canvas, the same element - goes position: fixed and flies
// from the hero box to the dock's slot ([data-core-slot]), shrinking; it
// snaps to the slot's real size at the end so the canvas renders small, at a
// capped frame rate. Undocking flies it back. The still's thinking and
// executing looks are a CSS recolour keyed on data-status.
//
// Dev only: ?state=idle|thinking|executing holds the core in one state.

type ShaderModule = { ShaderCore: (p: ShaderCoreProps) => React.JSX.Element };

const DEV = process.env.NODE_ENV === "development";
const FLIGHT_MS = 550;
const FLIGHT_EASE = "cubic-bezier(0.2, 0, 0, 1)";
const DOCKED_FPS = 24;
/** longer than R3F's debounced canvas measure (50ms) */
const MEASURE_MS = 80;

function canRunShader() {
  if (prefersReducedMotion()) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= 4) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** run `fn` now, or once the boot intro (pending or running) has ended */
function outsideIntro(fn: () => void): () => void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-intro")) {
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

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** the dock slot's box where it will be once the dock bar has slid in */
function slotBox(slot: HTMLElement): Box {
  const r = slot.getBoundingClientRect();
  const dock = slot.closest<HTMLElement>(".dock");
  const tr = dock ? getComputedStyle(dock).translate : "none";
  const dy = tr && tr !== "none" ? parseFloat(tr.split(" ")[1] ?? "0") || 0 : 0;
  return { left: r.left, top: r.top - dy, width: r.width, height: r.height };
}

function place(el: HTMLElement, b: Box) {
  el.style.left = `${b.left}px`;
  el.style.top = `${b.top}px`;
  el.style.width = `${b.width}px`;
  el.style.height = `${b.height}px`;
}

function unplace(el: HTMLElement) {
  el.style.left = el.style.top = el.style.width = el.style.height = "";
}

export function Core({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [ready, setReady] = useState(false);
  const [stillGone, setStillGone] = useState(false);
  const [lost, setLost] = useState(false);
  const [active, setActive] = useState(true);
  const [pointer, setPointer] = useState(false);
  const [forced, setForced] = useState<AgentStatus | null>(null);
  const status = useAgentState(statusOf);
  const docked = useAgentState((s) => s.docked);

  // decide, load, and mount outside the intro
  useEffect(() => {
    if (!canRunShader()) return;
    if (DEV) {
      const s = new URLSearchParams(location.search).get("state");
      if (s === "idle" || s === "thinking" || s === "executing") setForced(s);
    }
    setPointer(finePointer());

    let disposed = false;
    let undo = () => {};
    const shown = () => (wrap.current?.getBoundingClientRect().width ?? 0) > 0;
    const load = () => {
      void import("@/components/core/shader-core").then((m) => {
        if (disposed) return;
        undo = outsideIntro(() => !disposed && setMod(m));
      });
    };
    if (shown()) {
      load();
    } else {
      // hidden (phones): fetch nothing unless a resize shows it
      const onResize = () => {
        if (!shown()) return;
        window.removeEventListener("resize", onResize);
        load();
      };
      window.addEventListener("resize", onResize);
      return () => {
        disposed = true;
        undo();
        window.removeEventListener("resize", onResize);
      };
    }
    return () => {
      disposed = true;
      undo();
    };
  }, []);

  // pause off screen or in a hidden tab
  useEffect(() => {
    const el = wrap.current;
    if (!mod || !el) return;
    let inView = true;
    let visible = document.visibilityState !== "hidden";
    const update = () => setActive(inView && visible);
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
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mod]);

  // the still fades out under the first shader frame, then unmounts
  useEffect(() => {
    if (!ready) {
      setStillGone(false);
      return;
    }
    const id = setTimeout(() => setStillGone(true), 600);
    return () => clearTimeout(id);
  }, [ready]);

  // travel between the hero box and the dock slot
  useEffect(() => {
    const el = wrap.current;
    const home = el?.parentElement;
    const slot = document.querySelector<HTMLElement>("[data-core-slot]");
    if (!el || !home || !slot) return;
    const reduced = prefersReducedMotion();
    let anim: Animation | undefined;
    let nudge = 0;

    if (docked) {
      const from = home.getBoundingClientRect();
      const to = slotBox(slot);
      el.dataset.docked = "";
      // hidden in the hero (phones): nothing to fly from
      if (reduced || from.width < 1) {
        place(el, to);
      } else {
        place(el, from);
        const s = to.width / from.width;
        anim = el.animate(
          [
            { transform: "none" },
            { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${s})` },
          ],
          { duration: FLIGHT_MS, easing: FLIGHT_EASE, fill: "forwards" }
        );
        // land: the real small size, so the canvas renders small
        anim.onfinish = () => {
          place(el, slotBox(slot));
          anim?.cancel();
        };
      }
      const onResize = () => {
        if (!anim || anim.playState === "idle") place(el, slotBox(slot));
      };
      window.addEventListener("resize", onResize);
      return () => {
        anim?.cancel();
        window.removeEventListener("resize", onResize);
      };
    }

    if (!("docked" in el.dataset)) return;
    const from = slotBox(slot);
    const to = home.getBoundingClientRect();
    const finish = () => {
      unplace(el);
      el.style.transform = "";
      delete el.dataset.docked;
      // R3F measures its canvas with getBoundingClientRect, debounced, and a
      // measure taken mid-flight read the scaled box: one more layout change
      // now, untransformed and held past the debounce, sets it right
      el.style.width = "99.9%";
      nudge = window.setTimeout(() => {
        el.style.width = "";
      }, MEASURE_MS);
    };
    if (reduced || to.width < 1) {
      finish();
      return;
    }
    // the same measure would read the scaled box at take-off: sit hidden and
    // untransformed at the hero size past the debounce first, so the canvas
    // renders large on the way back
    place(el, to);
    el.style.visibility = "hidden";
    const hold = window.setTimeout(() => {
      el.style.visibility = "";
      const s = from.width / to.width;
      anim = el.animate(
        [
          { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${s})` },
          { transform: "none" },
        ],
        { duration: FLIGHT_MS, easing: FLIGHT_EASE, fill: "forwards" }
      );
      anim.onfinish = () => {
        anim?.cancel();
        finish();
      };
    }, MEASURE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(nudge);
      el.style.visibility = "";
      anim?.cancel();
    };
  }, [docked]);

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
          fps={docked ? DOCKED_FPS : 0}
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

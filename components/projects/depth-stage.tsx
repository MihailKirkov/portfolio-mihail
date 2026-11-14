"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { agentId, setDepthStage } from "@/lib/agent/targets";
import { onScroll, position, scrollToY } from "@/lib/scroll";
import { canRunWebGL, onDowngrade, startFrameProbe } from "@/lib/core/gate";
import { ProjectLinks, ProjectOverlay } from "@/components/projects/project-overlay";
import type { DepthDriver, DepthGLProps } from "@/components/projects/depth-gl";

// Scroll-driven depth chapters, layered over the static project list.
// The server renders plain vertical cards; on a wide viewport without reduced
// motion this sets data-depth="on" and the same list becomes a sticky stage:
// each chapter is an image-only slab moving along Z, with up to two upcoming
// slabs small and dim behind it, a flat info panel beside it for the front
// project, and the long content in a full-viewport overlay. Nothing on the
// stage scrolls inside itself.
//
// Motion: one progress value, read straight from the page's one scroll source
// (lib/scroll.ts: Lenis, or native scroll on touch and under reduced motion),
// drives the slabs or the scene, the rail and the info panel in the same call:
// no second smoothing layer and no snapping. Each project holds still for a
// share of the scroll at its stop. Within a transition (u, 0..1) the
// outgoing slab is gone at its midpoint, u = 0.5, and that is exactly where the
// rail and the panel switch to the incoming project. One index (frontIdx in
// render) drives all three in the same call: the slab's data-depth-state,
// the rail's aria-current and the panel's data-active. Every project's panel
// is rendered and only the active one shows, so the panel never waits on a
// React render or an exit animation (npm run test:projects checks it).
//
// WebGL. Where the shared gate passes (lib/core/gate.ts: no reduced motion,
// no data saver, hardware WebGL2, not a slow page), the scene in
// components/projects/depth-gl.tsx is fetched once the section is within a
// screen of the viewport (three is already in the core's shared chunk) and
// drawn behind the stage. The same progress drives it through a driver ref.
// Until its textures are in and its first frame is drawn the CSS slabs stay;
// then data-depth-gl is set, the slabs go invisible but stay in place at the
// front position as hit boxes and agent targets, and the canvas fades in.
// A lost context, or the gate's frame probe finding the page slow, drops
// back to the CSS slabs for good. The canvas renders only
// while the section is on screen and the tab is visible.

type GLModule = { DepthGL: (p: DepthGLProps) => React.JSX.Element };

export interface StageProject {
  slug: string;
  number: string;
  title: string;
  role: string;
  period: string;
  shortDescription: string;
  longDescription: string;
  stack: string[];
  gallery: string[];
  live?: string;
  repo?: string;
}

const QUERY =
  "(min-width: 768px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)";
/** share of each stop-to-stop scroll the front slab holds still, at each end */
const HOLD = 0.15;
/** the transition midpoint: the outgoing slab is gone, the panel switches */
const SWITCH = 0.5;
/** the incoming slabs start forward at this share of the transition */
const ADVANCE = 0.25;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

interface Look {
  transform: string;
  /** presence: 1 while drawn; fades the outgoing slab and the third one back */
  opacity: number;
  /** dark tint over the image (0 = front); upcoming slabs stay opaque so the
      nearer one fully covers the one behind it, no see-through ghosts */
  tint: number;
}

/** slab look at depth e (0 = front, 1 = next, 2 = after that, 3+ = not drawn) */
function upcoming(e: number): Look {
  return {
    transform: `translate3d(${(-3 * e).toFixed(3)}%, ${(-17 * e).toFixed(3)}%, ${(-300 * e).toFixed(1)}px) rotateY(${(10 * Math.min(e, 1)).toFixed(3)}deg)`,
    opacity: clamp01(3 - e),
    tint: e <= 1 ? 0.6 * e : 0.6 + 0.2 * Math.min(1, e - 1),
  };
}

/** the outgoing slab, u = share of the transition done */
function outgoing(u: number): Look {
  return {
    transform: `translate3d(0, 0, ${(320 * u).toFixed(1)}px)`,
    opacity: clamp01(1 - u / SWITCH),
    tint: 0,
  };
}

export function DepthStage({
  projects,
  rail,
  children,
}: {
  projects: StageProject[];
  rail: ReactNode;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [overlay, setOverlay] = useState<{ slug: string; gallery: boolean } | null>(null);
  const n = projects.length;
  const [glMod, setGlMod] = useState<GLModule | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [glLost, setGlLost] = useState(false);
  const [glActive, setGlActive] = useState(false);
  const [finePtr, setFinePtr] = useState(false);
  const gl = on && !!glMod && !glLost;
  const glOn = gl && glReady;
  const glOnRef = useRef(glOn);
  glOnRef.current = glOn;
  const driver = useRef<DepthDriver>({ cam: 0, front: 0, dimmed: projects.map(() => false) });
  const glImages = useMemo(() => projects.map((x) => x.gallery[0] ?? null), [projects]);
  // every chapter shares the front slab's layout box; the first one stands for it
  const glSlot = useCallback(
    () => rootRef.current?.querySelector<HTMLElement>("[data-depth-chapter]") ?? null,
    []
  );
  const onGlReady = useCallback(() => setGlReady(true), []);
  const onGlLost = useCallback(() => {
    setGlLost(true);
    setGlReady(false);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const measure = () => {
    const root = rootRef.current;
    const track = root?.querySelector<HTMLElement>(".depth-track");
    const stage = root?.querySelector<HTMLElement>(".depth-stage");
    if (!root || !track || !stage) return null;
    const stuckAt = parseFloat(getComputedStyle(stage).top) || 0;
    const start = track.getBoundingClientRect().top + window.scrollY - stuckAt;
    const range = Math.max(1, track.offsetHeight - stage.offsetHeight);
    return { start, range };
  };

  /** scrollY of chapter i's stop */
  const chapterY = (i: number) => {
    const m = measure();
    if (!m) return null;
    return Math.round(m.start + (n > 1 ? i / (n - 1) : 0) * m.range);
  };

  const read = () => {
    const m = measure();
    return m ? clamp01((position() - m.start) / m.range) : 0;
  };

  const render = (p: number) => {
    const root = rootRef.current;
    if (!root) return;
    const raw = p * Math.max(0, n - 1);
    const k = Math.min(Math.floor(raw), Math.max(0, n - 2));
    const u = smoothstep(clamp01((raw - k - HOLD) / (1 - 2 * HOLD)));
    const advance = smoothstep(clamp01((u - ADVANCE) / (1 - ADVANCE)));
    const frontIdx = n > 1 && u >= SWITCH ? k + 1 : k;

    driver.current.cam = n > 1 ? k + u : 0;
    const glNow = glOnRef.current;

    root.querySelectorAll<HTMLElement>("[data-depth-chapter]").forEach((el, i) => {
      let look: Look;
      if (i < k) look = outgoing(1);
      else if (i === k) look = u > 0 ? outgoing(u) : upcoming(0);
      else look = upcoming(i - k - advance);
      if (glNow) {
        // the scene draws; the slabs are invisible hit boxes at the front spot
        el.style.removeProperty("transform");
        el.style.removeProperty("--o");
        el.style.removeProperty("--t");
      } else {
        el.style.transform = look.transform;
        el.style.setProperty("--o", look.opacity.toFixed(3));
        el.style.setProperty("--t", look.tint.toFixed(3));
      }
      el.style.visibility = look.opacity < 0.004 ? "hidden" : "";
      el.style.zIndex = String(50 - (i - k));
      const state = i === frontIdx ? "front" : look.opacity >= 0.004 ? "near" : "far";
      if (el.dataset.depthState !== state) el.dataset.depthState = state;
    });
    root.querySelectorAll<HTMLElement>("[data-chapter-link]").forEach((a, i) => {
      if (i === frontIdx) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    root.querySelectorAll<HTMLElement>("[data-depth-panel]").forEach((el, i) => {
      const active = i === frontIdx;
      if (active === el.hasAttribute("data-active")) return;
      el.toggleAttribute("data-active", active);
      el.toggleAttribute("inert", !active);
      el.setAttribute("aria-hidden", String(!active));
    });
    root.dataset.depthFront = String(frontIdx);
    driver.current.front = frontIdx;
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!on) {
      root.querySelectorAll<HTMLElement>("[data-depth-chapter]").forEach((el) => {
        el.style.removeProperty("transform");
        el.style.removeProperty("--o");
        el.style.removeProperty("--t");
        el.style.removeProperty("visibility");
        el.style.removeProperty("z-index");
        delete el.dataset.depthState;
      });
      root.querySelectorAll("[data-chapter-link]").forEach((a) => a.removeAttribute("aria-current"));
      delete root.dataset.depthFront;
      setOverlay(null);
      return;
    }

    const slugs = projects.map((p) => p.slug);
    const indexOf = (el: Element | null) => {
      const ch = el?.closest("[data-depth-chapter]");
      if (!ch || !root.contains(ch)) return -1;
      return Array.from(root.querySelectorAll("[data-depth-chapter]")).indexOf(ch);
    };
    setDepthStage({
      scrollY: (el) => {
        const i = indexOf(el);
        return i < 0 ? null : chapterY(i);
      },
      openDetail: (slug) => {
        if (slugs.includes(slug)) setOverlay({ slug, gallery: false });
      },
      openGallery: (slug) => {
        if (slugs.includes(slug)) setOverlay({ slug, gallery: true });
      },
    });

    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      // the rail: jump to a chapter (plain #anchors without JS)
      const a = t.closest<HTMLAnchorElement>("[data-chapter-link]");
      if (a && root.contains(a)) {
        const y = chapterY(Number(a.dataset.chapterLink));
        if (y === null) return;
        e.preventDefault();
        void scrollToY(y);
        history.replaceState(null, "", a.hash);
        return;
      }
      // the front slab opens its detail overlay
      const slab = t.closest<HTMLElement>("[data-slab]");
      if (slab && root.contains(slab)) setOverlay({ slug: slab.dataset.slab!, gallery: false });
    };
    const onResize = () => render(read());
    const unScroll = onScroll(() => render(read()));
    // the docked bar grows with an answer and its tool log; the stage keeps
    // its real height clear so the bar never covers the stage
    const dock = document.querySelector<HTMLElement>(".dock");
    const dockRO = dock
      ? new ResizeObserver(() => root.style.setProperty("--dock-live", `${dock.offsetHeight}px`))
      : null;
    if (dock) dockRO?.observe(dock);

    root.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    // deep link to a chapter: land it at the front
    const hashIdx = location.hash ? indexOf(document.getElementById(location.hash.slice(1))) : -1;
    if (hashIdx >= 0) {
      const y = chapterY(hashIdx);
      if (y !== null) void scrollToY(y, { instant: true });
    }
    render(read());

    return () => {
      setDepthStage(null);
      unScroll();
      dockRO?.disconnect();
      root.style.removeProperty("--dock-live");
      root.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
    // render/measure only read refs, props and `on`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  // WebGL: decide once the stage is on; fetch the scene when the section nears
  useEffect(() => {
    const root = rootRef.current;
    if (!on || !root || glMod || glLost || !canRunWebGL()) return;
    setFinePtr(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    let disposed = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        void import("@/components/projects/depth-gl").then((m) => {
          if (!disposed) setGlMod(m);
        });
      },
      { rootMargin: "100% 0px" }
    );
    io.observe(root);
    return () => {
      disposed = true;
      io.disconnect();
    };
  }, [on, glMod, glLost]);

  // render only while the section is on screen and the tab is visible
  useEffect(() => {
    const root = rootRef.current;
    if (!gl || !root) return;
    let inView = false;
    let visible = document.visibilityState !== "hidden";
    const update = () => setGlActive(inView && visible);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gl]);

  // filter_projects dims chapters by attribute; the scene follows it
  useEffect(() => {
    const root = rootRef.current;
    if (!gl || !root) return;
    const read = () => {
      root.querySelectorAll<HTMLElement>("[data-depth-chapter]").forEach((el, i) => {
        driver.current.dimmed[i] = el.hasAttribute("data-dimmed");
      });
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, subtree: true, attributeFilter: ["data-dimmed"] });
    return () => mo.disconnect();
  }, [gl]);

  // the gate's frame probe: starts once the scene draws; a slow page drops
  // back to the CSS slabs, like a lost context
  useEffect(() => {
    if (!gl) return;
    return onDowngrade(onGlLost);
  }, [gl, onGlLost]);
  useEffect(() => {
    if (glOn) startFrameProbe();
  }, [glOn]);

  // hand-off between the CSS slabs and the scene, both ways
  useEffect(() => {
    if (on) render(read());
    // render only reads refs, props and `on`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glOn]);

  const open = overlay ? projects.find((x) => x.slug === overlay.slug) : undefined;

  return (
    <div
      ref={rootRef}
      className="depth"
      data-depth={on ? "on" : undefined}
      data-depth-gl={glOn ? "" : undefined}
    >
      <div className="depth-track" style={{ "--n": n } as CSSProperties}>
        <div className="depth-stage">
          {gl && glMod && (
            <div className="depth-gl" aria-hidden>
              <glMod.DepthGL
                images={glImages}
                driver={driver}
                slot={glSlot}
                active={glActive}
                pointer={finePtr}
                onReady={onGlReady}
                onLost={onGlLost}
              />
            </div>
          )}
          {/* server elements sit alone in their slots, never in a sibling list */}
          <div className="depth-rail">{rail}</div>
          <div className="depth-slabs">{children}</div>
          {on && (
            <aside className="depth-panel" aria-label="Project">
              {/* one panel per project; render() marks the front one active */}
              {projects.map((p, i) => (
                <div
                  key={p.slug}
                  className="depth-panel-inner"
                  data-depth-panel={p.slug}
                  data-active={i === 0 ? "" : undefined}
                  inert={i !== 0}
                  aria-hidden={i !== 0}
                >
                  <p className="label">
                    {p.number} / {String(n).padStart(2, "0")}
                  </p>
                  <h3 className="depth-panel-title">{p.title}</h3>
                  <p className="label">
                    {p.role} / {p.period}
                  </p>
                  <p className="depth-panel-lead">{p.shortDescription}</p>
                  <ul className="tags" aria-label="Stack">
                    {p.stack.map((s) => (
                      <li key={s} className="tag">
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div className="links">
                    <button
                      type="button"
                      className="btn"
                      data-agent-id={agentId.projectDetail(p.slug)}
                      onClick={() => setOverlay({ slug: p.slug, gallery: false })}
                    >
                      details
                    </button>
                    <ProjectLinks project={p} bare />
                  </div>
                </div>
              ))}
            </aside>
          )}
        </div>
      </div>
      {on && open && overlay && (
        <ProjectOverlay
          key={open.slug}
          project={open}
          gallery={overlay.gallery}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

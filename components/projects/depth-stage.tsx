"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "framer-motion";
import { agentId, setDepthStage } from "@/lib/agent/targets";
import { ProjectLinks, ProjectOverlay } from "@/components/projects/project-overlay";

// Scroll-driven depth chapters, layered over the static project list.
// The server renders plain vertical cards; on a wide viewport without reduced
// motion this sets data-depth="on" and the same list becomes a sticky stage:
// each chapter is an image-only slab moving along Z, with up to two upcoming
// slabs small and dim behind it, a flat info panel beside it for the front
// project, and the long content in a full-viewport overlay. Nothing on the
// stage scrolls inside itself.
//
// Motion: one spring-smoothed progress value drives every slab (transform and
// opacity only). The outgoing slab moves toward the viewer and is gone within
// the first quarter of a transition; the incoming one only starts forward
// after that, so the two never cross while both are visible.

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
/** the outgoing slab is fully faded by this share of the transition */
const OUT = 0.25;

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
    opacity: clamp01(1 - u / OUT),
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
  const [front, setFront] = useState(0);
  const [overlay, setOverlay] = useState<{ slug: string; gallery: boolean } | null>(null);
  const n = projects.length;

  const { scrollY } = useScroll();
  const target = useMotionValue(0);
  const progress = useSpring(target, { stiffness: 240, damping: 36, mass: 0.6, restDelta: 0.0002 });

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

  const readTarget = () => {
    const m = measure();
    return m ? clamp01((window.scrollY - m.start) / m.range) : 0;
  };

  const render = (p: number) => {
    const root = rootRef.current;
    if (!root) return;
    const raw = p * Math.max(0, n - 1);
    const k = Math.min(Math.floor(raw), Math.max(0, n - 2));
    const u = smoothstep(clamp01((raw - k - HOLD) / (1 - 2 * HOLD)));
    // the incoming slabs wait until the outgoing one has faded
    const advance = smoothstep(clamp01((u - OUT) / (1 - OUT)));
    const frontIdx = n > 1 && u >= 0.5 ? k + 1 : k;

    root.querySelectorAll<HTMLElement>("[data-depth-chapter]").forEach((el, i) => {
      let look: Look;
      if (i < k) look = outgoing(1);
      else if (i === k) look = u > 0 ? outgoing(u) : upcoming(0);
      else look = upcoming(i - k - advance);
      el.style.transform = look.transform;
      el.style.setProperty("--o", look.opacity.toFixed(3));
      el.style.setProperty("--t", look.tint.toFixed(3));
      el.style.visibility = look.opacity < 0.004 ? "hidden" : "";
      el.style.zIndex = String(50 - (i - k));
      const state = i === frontIdx ? "front" : look.opacity >= 0.004 ? "near" : "far";
      if (el.dataset.depthState !== state) el.dataset.depthState = state;
    });
    root.querySelectorAll<HTMLElement>("[data-chapter-link]").forEach((a, i) => {
      if (i === frontIdx) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    setFront((f) => (f === frontIdx ? f : frontIdx));
  };

  useMotionValueEvent(scrollY, "change", () => {
    if (on) target.set(readTarget());
  });
  useMotionValueEvent(progress, "change", (p) => {
    if (on) render(p);
  });

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
        window.scrollTo({ top: y, behavior: "smooth" });
        history.replaceState(null, "", a.hash);
        return;
      }
      // the front slab opens its detail overlay
      const slab = t.closest<HTMLElement>("[data-slab]");
      if (slab && root.contains(slab)) setOverlay({ slug: slab.dataset.slab!, gallery: false });
    };
    const onResize = () => {
      target.set(readTarget());
      render(progress.get());
    };
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
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
    }
    const p0 = readTarget();
    target.set(p0);
    progress.jump(p0);
    render(p0);

    return () => {
      setDepthStage(null);
      dockRO?.disconnect();
      root.style.removeProperty("--dock-live");
      root.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
    // render/measure only read refs, props and `on`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const p = projects[Math.min(front, n - 1)];
  const open = overlay ? projects.find((x) => x.slug === overlay.slug) : undefined;

  return (
    <div ref={rootRef} className="depth" data-depth={on ? "on" : undefined}>
      <div className="depth-track" style={{ "--n": n } as CSSProperties}>
        {projects.map((x, i) => (
          <span
            key={x.slug}
            className="depth-stop"
            style={{ "--i": i } as CSSProperties}
            aria-hidden
          />
        ))}
        <div className="depth-stage">
          {/* server elements sit alone in their slots, never in a sibling list */}
          <div className="depth-rail">{rail}</div>
          <div className="depth-slabs">{children}</div>
          {on && p && (
            <aside className="depth-panel" aria-label="Project">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={p.slug}
                  className="depth-panel-inner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
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
                </motion.div>
              </AnimatePresence>
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

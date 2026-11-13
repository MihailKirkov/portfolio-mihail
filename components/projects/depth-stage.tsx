"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { setDepthScroll } from "@/lib/agent/targets";

// Scroll-driven depth chapters, layered over the static project list.
// The server renders plain vertical cards; once mounted on a wide viewport
// without reduced motion this sets data-depth="on" and the CSS turns the same
// markup into a sticky perspective stage: each chapter is a slab that moves
// along Z with scroll, the next one waiting small in the distance. Per frame
// it writes one --d (distance from the front, in chapters) per slab, plus a
// data-depth-state the agent's target helpers read. No second copy of the DOM.

const QUERY =
  "(min-width: 768px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)";
/** share of each chapter-to-chapter scroll the front slab holds still, at each end */
const HOLD = 0.3;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function DepthStage({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const parts = () => {
    const root = rootRef.current;
    if (!root) return null;
    const track = root.querySelector<HTMLElement>(".depth-track");
    const stage = root.querySelector<HTMLElement>(".depth-stage");
    if (!track || !stage) return null;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-depth-chapter]"));
    const rail = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter-link]"));
    const stuckAt = parseFloat(getComputedStyle(stage).top) || 0;
    const start = track.getBoundingClientRect().top + window.scrollY - stuckAt;
    const range = Math.max(1, track.offsetHeight - stage.offsetHeight);
    return { chapters, rail, start, range };
  };

  /** scrollY that puts chapter i at the front (mid-hold) */
  const chapterY = (i: number) => {
    const p = parts();
    if (!p) return null;
    const n = p.chapters.length;
    return Math.round(p.start + (n > 1 ? i / (n - 1) : 0) * p.range);
  };

  const update = () => {
    if (!on) return;
    const p = parts();
    if (!p) return;
    const n = p.chapters.length;
    const progress = Math.min(1, Math.max(0, (window.scrollY - p.start) / p.range));
    const raw = progress * Math.max(0, n - 1);
    const k = Math.min(Math.floor(raw), Math.max(0, n - 2));
    const f = raw - k;
    const moved = smoothstep(Math.min(1, Math.max(0, (f - HOLD) / (1 - 2 * HOLD))));
    const at = k + moved;
    const front = Math.round(at);
    p.chapters.forEach((el, i) => {
      const d = at - i;
      el.style.setProperty("--d", d.toFixed(4));
      // the list flattens its 3D children, so paint order is set by hand:
      // earlier chapters are always nearer the viewer
      el.style.zIndex = String(n - i);
      // "near" = still drawn (the CSS fades a slab out past d 0.45 and -1.66)
      const state = i === front && Math.abs(d) < 0.5 ? "front" : d > -1.6 && d < 0.45 ? "near" : "far";
      if (el.dataset.depthState !== state) el.dataset.depthState = state;
    });
    p.rail.forEach((a, i) => {
      if (i === front) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  };

  useMotionValueEvent(scrollY, "change", update);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!on) {
      root.querySelectorAll<HTMLElement>("[data-depth-chapter]").forEach((el) => {
        el.style.removeProperty("--d");
        el.style.removeProperty("z-index");
        delete el.dataset.depthState;
      });
      root
        .querySelectorAll("[data-chapter-link]")
        .forEach((a) => a.removeAttribute("aria-current"));
      return;
    }

    const indexOf = (el: Element | null) => {
      const ch = el?.closest("[data-depth-chapter]");
      if (!ch || !root.contains(ch)) return -1;
      return Array.from(root.querySelectorAll("[data-depth-chapter]")).indexOf(ch);
    };
    setDepthScroll((el) => {
      const i = indexOf(el);
      return i < 0 ? null : chapterY(i);
    });

    // the rail: jump to a chapter (the links are plain #anchors without JS)
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("[data-chapter-link]");
      if (!a || !root.contains(a)) return;
      const i = Number(a.dataset.chapterLink);
      const y = chapterY(i);
      if (y === null) return;
      e.preventDefault();
      window.scrollTo({ top: y, behavior: "smooth" });
      history.replaceState(null, "", a.hash);
    };
    // keyboard: tabbing into a chapter that is not at the front brings it there
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-depth-state]")?.getAttribute("data-depth-state") === "front") return;
      const i = indexOf(t);
      const y = i < 0 ? null : chapterY(i);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
    };
    // an expanded detail scrolls its own column, never the page
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!(d instanceof HTMLDetailsElement) || !d.open) return;
      const col = d.closest<HTMLElement>(".project-text");
      if (!col || indexOf(d) < 0) return;
      col.scrollTo({ top: d.offsetTop - col.offsetTop - 8, behavior: "smooth" });
    };
    const onResize = () => update();

    root.addEventListener("click", onClick);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("toggle", onToggle, true);
    window.addEventListener("resize", onResize);
    update();

    // deep link to a chapter: land it at the front
    const hashIdx = location.hash ? indexOf(document.getElementById(location.hash.slice(1))) : -1;
    if (hashIdx >= 0) {
      const y = chapterY(hashIdx);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
    }

    return () => {
      setDepthScroll(null);
      root.removeEventListener("click", onClick);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("resize", onResize);
    };
    // update/chapterY only read refs and `on`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <div ref={rootRef} className="depth" data-depth={on ? "on" : undefined}>
      {children}
    </div>
  );
}

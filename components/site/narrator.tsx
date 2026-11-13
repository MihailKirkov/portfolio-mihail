"use client";

import { useEffect, useRef, useState } from "react";
import type { Narration, NarrationLine } from "@/lib/types";
import { prefersReducedMotion } from "@/lib/agent/choreo";
import { getAgentState, setAgentState, subscribeAgentState } from "@/lib/agent/store";
import { pulse, resolveTarget } from "@/lib/agent/targets";

// The narrator (V3-PLAN Round 2, part 1). No model calls: every line comes
// from seed.narration.
//
// - First entry into a section in this visit: the core shows that section's
//   line in a small bubble beside it for about 4s and pulses the line's
//   highlight target once. Once per section per visit.
// - About 12s with no input: the core wakes (store `awake`: it turns toward
//   the pointer, its rings speed up) and shows the idle hint once. Nothing on
//   the page moves or scrolls.
// - Typing in the command bar, a chip, or any agent run stops narration for
//   the rest of the visit.
// - The bubble is aria-live polite; under reduced motion it is plain text
//   (no animation, no pulse, no wake).

const SHOW_MS = 4000;
const IDLE_MS = 12000;
const GAP = 14;
const EDGE = 16;
/** a section must hold the viewport's centre this long to be "entered" */
const DWELL_MS = 250;

/** inputs that count as activity for the idle timer (pointer movement does
 *  not: the woken core turns toward a resting pointer) */
const INPUTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

function introRunning() {
  return document.documentElement.hasAttribute("data-intro");
}

/** the element the core is drawn over right now */
function coreAnchor(): HTMLElement | null {
  // the core itself: it dissolves and re-forms between spots, and the bubble
  // stays with what is drawn, not with where it is headed
  const stack = document.querySelector<HTMLElement>(".core-stack");
  if (stack && stack.getBoundingClientRect().width > 0) return stack;
  const s = getAgentState();
  if (!s.docked) return document.querySelector<HTMLElement>(".hero-core");
  return (
    document.querySelector<HTMLElement>(`[data-core-slot="${s.coreSpot}"]`) ??
    document.querySelector<HTMLElement>('[data-core-slot="dock"]')
  );
}

export function Narrator({ narration }: { narration: Narration }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const seen = new Set<string>();
    let stopped = false;
    let hideTimer = 0;
    let idleTimer = 0;
    let idleShown = false;
    let raf = 0;
    let current: string | null = null;
    let pendingSection: string | null = null;
    /** the section the bubble's line belongs to (null for the idle hint) */
    let saidFor: string | null = null;
    let dwellTimer = 0;
    let scrollRaf = 0;

    const place = () => {
      const el = bubble.current;
      const a = coreAnchor();
      if (el && a) {
        const r = a.getBoundingClientRect();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x: number;
        let y: number;
        if (r.top > vh * 0.6) {
          // core in the lower part (the dock): above it
          x = r.left + r.width / 2 - w / 2;
          y = r.top - h - GAP;
        } else {
          x = r.right + w + GAP < vw - EDGE ? r.right + GAP : r.left - w - GAP;
          y = r.top + r.height / 2 - h / 2;
        }
        x = Math.max(EDGE, Math.min(vw - w - EDGE, x));
        y = Math.max(EDGE, Math.min(vh - h - EDGE, y));
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      }
      raf = requestAnimationFrame(place);
    };

    const hide = () => {
      clearTimeout(hideTimer);
      cancelAnimationFrame(raf);
      setShown(false);
      if (getAgentState().awake) setAgentState({ awake: false });
    };

    const say = (n: NarrationLine | undefined, section: string | null = null) => {
      if (!n?.line || stopped) return;
      saidFor = section;
      clearTimeout(hideTimer);
      cancelAnimationFrame(raf);
      setText(n.line);
      setShown(true);
      raf = requestAnimationFrame(place);
      if (n.highlight && !reduced) {
        const t = resolveTarget(n.highlight);
        if (t) pulse(t);
      }
      hideTimer = window.setTimeout(hide, SHOW_MS);
    };

    const enter = (id: string) => {
      current = id;
      if (stopped || seen.has(id)) return;
      if (introRunning()) {
        pendingSection = id;
        return;
      }
      seen.add(id);
      say(narration.sections[id], id);
    };

    /** the section under the viewport's vertical centre: the one the visitor is in */
    const sections = () => [...document.querySelectorAll<HTMLElement>("main > section[id]")];
    const sectionAtCentre = () => {
      const y = window.innerHeight / 2;
      for (const s of sections()) {
        const r = s.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) return s.id;
      }
      return null;
    };
    const check = () => {
      scrollRaf = 0;
      const id = sectionAtCentre();
      if (id === current) return;
      current = id;
      // a line never outlives its section
      if (saidFor && saidFor !== id) hide();
      clearTimeout(dwellTimer);
      if (!id) return;
      // only once the visitor stays: a fast scroll past says nothing
      dwellTimer = window.setTimeout(() => {
        if (sectionAtCentre() === id) enter(id);
      }, DWELL_MS);
    };
    const onScrollCheck = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(check);
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(idleTimer);
      hide();
      unsub();
      window.removeEventListener("scroll", onScrollCheck);
      window.removeEventListener("resize", onScrollCheck);
      cancelAnimationFrame(scrollRaf);
      clearTimeout(dwellTimer);
      mo.disconnect();
      INPUTS.forEach((e) => window.removeEventListener(e, onInput, true));
      document.removeEventListener("input", onType, true);
      document.removeEventListener("visibilitychange", armIdle);
    };

    const armIdle = () => {
      clearTimeout(idleTimer);
      if (stopped || idleShown || document.hidden) return;
      idleTimer = window.setTimeout(() => {
        if (stopped || introRunning() || document.hidden) return armIdle();
        idleShown = true;
        if (!reduced) setAgentState({ awake: true });
        say(narration.idle, null);
      }, IDLE_MS);
    };

    const onInput = () => {
      if (getAgentState().awake) setAgentState({ awake: false });
      armIdle();
    };

    // typing in the command bar ends narration for the visit
    const onType = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".cmd, .dock")) stop();
    };

    // a chip or a typed question sets `requesting`; any cursor run sets
    // `executing` (the boot intro runs on the same engine: not an agent run)
    const unsub = subscribeAgentState(() => {
      const s = getAgentState();
      if (s.requesting || (s.executing && !s.ambient && !introRunning())) stop();
    });

    // the section holding the viewport's centre is "entered" (not merely one
    // crossing a band around it: that let the next section speak early)
    window.addEventListener("scroll", onScrollCheck, { passive: true });
    window.addEventListener("resize", onScrollCheck);
    check();

    // a section entered during the intro speaks once the intro has ended
    const mo = new MutationObserver(() => {
      if (introRunning()) return;
      const id = pendingSection;
      pendingSection = null;
      if (id && id === current) enter(id);
      armIdle();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });

    INPUTS.forEach((e) => window.addEventListener(e, onInput, { capture: true, passive: true }));
    document.addEventListener("input", onType, true);
    document.addEventListener("visibilitychange", armIdle);
    armIdle();

    return () => {
      stop();
      clearTimeout(hideTimer);
    };
  }, [narration]);

  return (
    <div
      ref={bubble}
      className="narrator"
      data-shown={shown}
      role="status"
      aria-live="polite"
    >
      {shown ? text : ""}
    </div>
  );
}

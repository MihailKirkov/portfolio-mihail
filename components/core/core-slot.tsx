"use client";

import { useEffect, useRef } from "react";
import { getAgentState, setAgentState, type CoreSpot } from "@/lib/agent/store";

// An in-page resting place for the docked core. While the slot's section
// holds the middle of the viewport the section claims the core
// (coreSpot), and components/core/core.tsx flies it here from the dock;
// once the section leaves, the core returns to the dock. Not on phones
// (the plain fallback keeps the core in the dock) and not under reduced
// motion. The slot is an empty, decorative box.

export function CoreSlot({
  spot,
  className,
}: {
  spot: Exclude<CoreSpot, "dock">;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const update = () => {
      // a slot inside a hidden fallback never claims the core
      const shown = el.getClientRects().length > 0;
      const claim = inView && shown && wide.matches && !still.matches;
      const cur = getAgentState().coreSpot;
      if (claim && cur !== spot) setAgentState({ coreSpot: spot });
      else if (!claim && cur === spot) setAgentState({ coreSpot: "dock" });
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        update();
      },
      // the section crosses the middle band of the viewport
      { rootMargin: "-45% 0px -45% 0px" }
    );
    io.observe(section);
    wide.addEventListener("change", update);
    still.addEventListener("change", update);
    return () => {
      io.disconnect();
      wide.removeEventListener("change", update);
      still.removeEventListener("change", update);
      if (getAgentState().coreSpot === spot) setAgentState({ coreSpot: "dock" });
    };
  }, [spot]);

  return <span ref={ref} className={className} data-core-slot={spot} aria-hidden="true" />;
}

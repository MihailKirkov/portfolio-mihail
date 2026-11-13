"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CoreSlot } from "@/components/core/core-slot";

// The experience timeline's motion layer. The list is complete static HTML
// with the line fully drawn; on wide screens with motion allowed this
// draws the line down to the middle of the viewport as the visitor scrolls
// (a scaleY on the line, --drawn 0..1), marks each node once the tip has
// passed it, and carries the core's timeline spot along the tip, so the
// docked core travels down the line while this section is in view.

export function TimelineDraw({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const slot = tip.current;
    if (!root || !slot) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));

    const update = () => {
      if (!wide.matches || still.matches) {
        delete root.dataset.draw;
        return;
      }
      root.dataset.draw = "";
      const r = root.getBoundingClientRect();
      const y = Math.min(Math.max(window.innerHeight / 2 - r.top, 0), r.height);
      root.style.setProperty("--drawn", r.height ? String(y / r.height) : "0");
      slot.style.transform = `translateY(${y}px)`;
      for (const n of nodes) {
        const top = n.getBoundingClientRect().top - r.top;
        if (top <= y) n.dataset.reached = "";
        else delete n.dataset.reached;
      }
    };
    // registered at mount, before the core's own scroll tracking, so the
    // spot has moved by the time the core reads it
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    wide.addEventListener("change", update);
    still.addEventListener("change", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      wide.removeEventListener("change", update);
      still.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="xp" ref={ref}>
      <span className="xp-line" aria-hidden="true" />
      <div className="xp-tip" ref={tip} aria-hidden="true">
        <CoreSlot spot="timeline" className="xp-core" />
      </div>
      {children}
    </div>
  );
}

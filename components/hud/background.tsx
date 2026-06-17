"use client";

import { useEffect } from "react";

// Fixed deterministic particle field (no Math.random — keeps SSR/CSR markup
// identical, no hydration mismatch). Values are %/px/seconds.
const PARTICLES = [
  { left: "7%", top: "24%", size: 4, dur: 13, delay: 0 },
  { left: "16%", top: "68%", size: 6, dur: 16, delay: 2 },
  { left: "24%", top: "12%", size: 5, dur: 11, delay: 4 },
  { left: "33%", top: "82%", size: 5, dur: 10, delay: 2 },
  { left: "41%", top: "40%", size: 7, dur: 18, delay: 5 },
  { left: "49%", top: "74%", size: 5, dur: 18, delay: 3 },
  { left: "58%", top: "18%", size: 5, dur: 15, delay: 4 },
  { left: "64%", top: "58%", size: 7, dur: 17, delay: 1 },
  { left: "72%", top: "30%", size: 5, dur: 12, delay: 7 },
  { left: "79%", top: "78%", size: 5, dur: 15, delay: 2 },
  { left: "86%", top: "44%", size: 7, dur: 16, delay: 5 },
  { left: "92%", top: "16%", size: 5, dur: 14, delay: 3 },
  { left: "12%", top: "48%", size: 5, dur: 17, delay: 7 },
  { left: "53%", top: "8%", size: 5, dur: 12, delay: 1 },
];

export function Background() {
  // Subtle parallax of the depth layers following the cursor across the whole
  // window. Disabled under prefers-reduced-motion (vars stay 0 → static).
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    function onMove(e: PointerEvent) {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      const root = document.documentElement.style;
      root.setProperty("--bgx", `${x * 18}px`);
      root.setProperty("--bgy", `${y * 18}px`);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="p"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              zIndex: 999,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

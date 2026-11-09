"use client";

import { useEffect, useRef } from "react";

// CSS ring core: the SSR placeholder and the no-WebGL / reduced-motion
// fallback for the phase 4 shader core. Each ring sits on its own translateZ
// plane, so the pointer tilt (--tiltX/--tiltY) reads as parallax depth.

export function CssCore({ label = "MK" }: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const MAX_TILT = 14; // degrees
    function onMove(e: PointerEvent) {
      const px = e.clientX / window.innerWidth - 0.5;
      const py = e.clientY / window.innerHeight - 0.5;
      el!.style.setProperty("--tiltY", `${px * MAX_TILT * 2}deg`);
      el!.style.setProperty("--tiltX", `${-py * MAX_TILT * 2}deg`);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="core" ref={ref} aria-hidden="true">
      <div className="core-layer" style={{ transform: "translateZ(0px)" }}>
        <div className="core-ring" />
      </div>
      <div className="core-layer" style={{ transform: "translateZ(24px)" }}>
        <div className="core-ring" style={{ inset: "12%" }} />
      </div>
      <div className="core-layer" style={{ transform: "translateZ(44px)" }}>
        <div className="core-ring core-ring-dashed" style={{ inset: "24%" }} />
      </div>
      <div className="core-layer" style={{ transform: "translateZ(64px)" }}>
        <div className="core-hub">{label}</div>
      </div>
    </div>
  );
}

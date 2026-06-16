"use client";

import { useEffect, useState } from "react";

// Decorative capability gauge. Fills on mount (and re-fills when `trigger`
// changes, e.g. on a mode switch) for the HUD "boot" feel.
export function Gauge({
  left,
  right,
  value,
  trigger,
}: {
  left: string;
  right?: string;
  value: number;
  trigger?: unknown;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(0);
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value, trigger]);

  return (
    <div className="gauge">
      <div className="gl">
        <span>{left}</span>
        {right && <span>{right}</span>}
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

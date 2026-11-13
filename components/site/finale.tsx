"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { canRunWebGL } from "@/lib/core/gate";
import type { FinaleItem } from "@/components/site/finale-orbit";

const FinaleOrbit = dynamic(
  () => import("@/components/site/finale-orbit").then((m) => m.FinaleOrbit),
  { ssr: false }
);

// Loads the finale's orbit layer once contact is within one screen, where
// the core's gate passes on a wide viewport. Otherwise contact stays the
// static ending: the large still core and the same content.
export function Finale({ images, skills }: { images: FinaleItem[]; skills: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current?.closest("section");
    const wide = window.matchMedia("(min-width: 768px)");
    if (!el || !wide.matches || !canRunWebGL()) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setOn(true);
      },
      { rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="finale-anchor" aria-hidden="true">
      {on && <FinaleOrbit images={images} skills={skills} />}
    </span>
  );
}

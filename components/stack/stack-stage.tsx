"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { canRunWebGL } from "@/lib/core/gate";
import type { SkillNode } from "@/lib/skills";
import type { ConstellationProject } from "@/components/stack/constellation";

const Constellation = dynamic(
  () => import("@/components/stack/constellation").then((m) => m.Constellation),
  { ssr: false }
);

// The stack section's stage. The server renders the tiered list (the
// fallback: phones, reduced motion, low-end, no WebGL, no JS). Where the
// core's gate passes on a wide viewport, the constellation is loaded once the
// section is within one screen and replaces the list.

export function StackStage({
  skills,
  projects,
  children,
}: {
  skills: SkillNode[];
  projects: ConstellationProject[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [able, setAble] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const update = () => setAble(wide.matches && canRunWebGL());
    update();
    wide.addEventListener("change", update);
    return () => wide.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !able || near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [able, near]);

  const on = able && near;
  return (
    <div ref={ref} className="stack-stage" data-constellation={on || undefined}>
      {on && <Constellation skills={skills} projects={projects} />}
      <div className="stack-fallback" hidden={on}>
        {children}
      </div>
    </div>
  );
}

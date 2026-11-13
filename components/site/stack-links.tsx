"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { validateAction } from "@/lib/agent/actions";
import { prefersReducedMotion } from "@/lib/agent/choreo";

// Stack tags that appear in a project's stack are plain #project-<slug>
// links. With JS a click runs the open_project effect directly (no agent
// cursor: the visitor drove this), so the depth stage brings that chapter
// to the front and opens its detail.
export function StackLinks({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-project]");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const valid = validateAction({ name: "open_project", params: { slug: a.dataset.project } });
      if (!valid) return;
      e.preventDefault();
      void valid.def.run(valid.params, {
        instant: prefersReducedMotion(),
        signal: new AbortController().signal,
      });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);
  return <div ref={ref}>{children}</div>;
}

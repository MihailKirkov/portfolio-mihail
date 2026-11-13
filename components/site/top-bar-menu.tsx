"use client";

import { useEffect, useRef } from "react";

// Phones only (the inline nav is hidden under 900px). A native <details> so it
// opens with JS off; JS only closes it on a link click, Escape or a tap outside.

export function TopBarMenu({ items }: { items: string[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = (focusSummary: boolean) => {
      if (!el.open) return;
      el.open = false;
      if (focusSummary) el.querySelector("summary")?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(el.contains(document.activeElement));
    };
    const onDown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <details ref={ref} className="topbar-menu">
      <summary className="btn label" aria-label="Sections menu">
        menu
      </summary>
      <nav aria-label="Sections" className="topbar-menu-panel">
        {items.map((id) => (
          <a
            key={id}
            className="label"
            href={`#${id}`}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            {id}
          </a>
        ))}
      </nav>
    </details>
  );
}

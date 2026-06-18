import type { TimelineEntry } from "@/lib/types";

// Vertical HUD career timeline. Semantic <ol> for a11y; dated ticks on a cold-blue
// rail. Items stagger in on open via CSS (.tl-item animation-delay) and render
// static under prefers-reduced-motion (the global reduced-motion rule kills the
// animations, leaving every item at its final visible state).
export function CareerTimeline({ items }: { items: TimelineEntry[] }) {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <ol className="tl">
      {sorted.map((it, i) => (
        <li
          className="tl-item"
          key={it.id}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className="tl-dot" aria-hidden="true" />
          <span className="tl-date">{it.date}</span>
          <span className="tl-text">{it.label}</span>
        </li>
      ))}
    </ol>
  );
}

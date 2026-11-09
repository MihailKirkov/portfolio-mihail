import type { ReactNode } from "react";

// Shared frame for every section below the hero: mono label, heading, body.
export function Section({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="section"
      data-agent-id={`section:${id}`}
      aria-labelledby={`${id}-title`}
    >
      <header className="section-head">
        <p className="label">{label}</p>
        <h2 id={`${id}-title`} className="section-title">
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

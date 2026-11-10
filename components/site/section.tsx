import type { ReactNode } from "react";
import { agentId, type SectionId } from "@/lib/agent/targets";

// Shared frame for every section below the hero: mono label, heading, body.
export function Section({
  id,
  label,
  title,
  children,
}: {
  id: SectionId;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="section"
      data-agent-id={agentId.section(id)}
      aria-labelledby={`${id}-title`}
    >
      <header className="section-head">
        <p className="label">{label}</p>
        <h2 id={`${id}-title`} className="section-title" data-agent-aim>
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

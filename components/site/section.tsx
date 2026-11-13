import type { ReactNode } from "react";
import { agentId, type SectionId } from "@/lib/agent/targets";

// Shared frame for every section below the hero: heading, body. No section
// numbers: the hero has no slot for one, and numbers shift whenever a
// section is added or reordered.
export function Section({
  id,
  title,
  children,
  hideTitle = false,
}: {
  id: SectionId;
  title: string;
  children: ReactNode;
  /** keep the heading for screen readers only; the section then marks its
   *  own data-agent-aim */
  hideTitle?: boolean;
}) {
  return (
    <section
      id={id}
      className="section"
      data-agent-id={agentId.section(id)}
      aria-labelledby={`${id}-title`}
    >
      {hideTitle ? (
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>
      ) : (
        <header className="section-head">
          <h2 id={`${id}-title`} className="section-title" data-agent-aim>
            {title}
          </h2>
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

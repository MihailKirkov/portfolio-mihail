import type { ReactNode } from "react";
import type { Content, Experience, TimelineEntry } from "@/lib/types";
import { agentId } from "@/lib/agent/targets";
import { TimelineDraw } from "@/components/site/timeline-draw";

// Renderers for the compact static sections below the projects. Every value
// comes from seed.json; nothing here may add facts of its own.

export type SectionKey = "stack" | "experience" | "credentials";

export interface Section {
  key: SectionKey;
  /** mono label shown above the heading */
  label: string;
  title: string;
  body: ReactNode;
}

const byOrder = <T extends { sort_order: number }>(xs: T[]) =>
  [...xs].sort((a, b) => a.sort_order - b.sort_order);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** a sortable key for a seed date string ("2019", "Feb 2024", "Apr-May 2026") */
function dateKey(d: string) {
  const year = Number(d.match(/\d{4}/)?.[0] ?? 0);
  const m = MONTHS.indexOf(d.slice(0, 3).toLowerCase());
  return year * 12 + (m < 0 ? 0 : m);
}

type TimelineNode =
  | { kind: "role"; e: Experience; key: number }
  | { kind: "mark"; t: TimelineEntry; key: number };

/** roles and milestones on one line, newest first; a milestone that marks
 *  the start of a role (same id) is that role's node, not a second date */
function experienceTimeline(experiences: Experience[], timeline: TimelineEntry[]): TimelineNode[] {
  const roles = new Set(experiences.map((e) => e.id));
  const nodes: TimelineNode[] = [
    ...byOrder(experiences).map((e) => ({ kind: "role" as const, e, key: dateKey(e.start) })),
    ...byOrder(timeline)
      .filter((t) => !roles.has(t.id))
      .map((t) => ({ kind: "mark" as const, t, key: dateKey(t.date) })),
  ];
  // stable: equal dates keep roles before milestones
  return nodes.sort((a, b) => b.key - a.key);
}

export function buildSections(content: Content): Section[] {
  const {
    identity,
    experiences,
    skill_groups,
    certifications,
    education,
    competitive,
    timeline,
    languages,
  } = content;

  return [
    {
      key: "stack",
      label: "03 / stack",
      title: "Stack",
      body: (
        <dl className="grid-list">
          {byOrder(skill_groups).map((g) => (
            <div key={g.id} className="grid-row" data-agent-id={agentId.stack(g.id)}>
              <dt className="label">{g.label}</dt>
              <dd>
                <ul className="tags">
                  {g.items.map((s) => (
                    <li key={s} className="tag">
                      {s}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      key: "experience",
      label: "04 / experience",
      title: "Experience",
      body: (
        <>
          <div className="about">
            <p>{identity.about}</p>
            <p className="muted">{identity.fun_fact}</p>
          </div>
          <TimelineDraw>
            <ol className="xp-list">
              {experienceTimeline(experiences, timeline).map((n) =>
                n.kind === "role" ? (
                  <li
                    key={n.e.id}
                    className="xp-role"
                    data-node="role"
                    data-agent-id={agentId.experience(n.e.id)}
                  >
                    <p className="label">
                      {n.e.start} - {n.e.end}
                    </p>
                    <h3 className="row-title">
                      {n.e.role} <span className="muted">/ {n.e.company}</span>
                    </h3>
                    {n.e.bullets.length > 0 && (
                      <ul className="bullets">
                        {n.e.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ) : (
                  <li key={n.t.id} className="xp-mark" data-node="mark">
                    <span className="label">{n.t.date}</span>
                    <span>{n.t.label}</span>
                  </li>
                )
              )}
            </ol>
          </TimelineDraw>
        </>
      ),
    },
    {
      key: "credentials",
      label: "05 / credentials",
      title: "Credentials",
      body: (
        <div className="grid-list">
          <div className="grid-row">
            <h3 className="label">certifications</h3>
            <ul className="plain">
              {byOrder(certifications).map((c) => (
                <li key={c.id}>
                  <span className="row-title">{c.name}</span>
                  <span className="muted">
                    {" "}
                    / {c.issuer}, {c.date}
                    {c.note ? ` - ${c.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid-row">
            <h3 className="label">education</h3>
            <ul className="plain">
              {byOrder(education).map((ed) => (
                <li key={ed.id}>
                  <span className="row-title">{ed.institution}</span>
                  <span className="muted"> / {ed.period}</span>
                  <br />
                  {ed.focus}. <span className="muted">{ed.credential_line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid-row">
            <h3 className="label">competitive</h3>
            <ul className="plain">
              {competitive.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
          <div className="grid-row">
            <h3 className="label">languages</h3>
            <ul className="plain">
              {byOrder(languages).map((l) => (
                <li key={l.id}>
                  {l.name} <span className="muted">/ {l.level}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
  ];
}

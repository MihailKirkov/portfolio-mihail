import type { ReactNode } from "react";
import type { Content } from "@/lib/types";

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
            <div key={g.id} className="grid-row" data-agent-id={`stack:${g.id}`}>
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
          <div className="grid-list">
            {byOrder(experiences).map((e) => (
              <article key={e.id} className="grid-row" data-agent-id={`experience:${e.id}`}>
                <p className="label">
                  {e.start} - {e.end}
                </p>
                <div>
                  <h3 className="row-title">
                    {e.role} <span className="muted">/ {e.company}</span>
                  </h3>
                  <ul className="bullets">
                    {e.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <h3 className="sub-head label">timeline</h3>
          <ol className="timeline">
            {byOrder(timeline).map((t) => (
              <li key={t.id}>
                <span className="label">{t.date}</span>
                <span>{t.label}</span>
              </li>
            ))}
          </ol>
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

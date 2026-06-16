import type { ReactNode } from "react";
import type { Content } from "@/lib/types";

export type SectionKey =
  | "identity"
  | "experience"
  | "stack"
  | "projects"
  | "ai"
  | "credentials";

export interface Section {
  key: SectionKey;
  /** node label shown on the HUD */
  label: string;
  /** small sublabel used by some layouts */
  sub: string;
  /** modal heading */
  title: string;
  /** modal body */
  body: ReactNode;
}

const B = ({ children }: { children: ReactNode }) => <b>{children}</b>;

export function buildSections(content: Content): Section[] {
  const { profile, experiences, skill_groups, projects, certifications, education, competitive } =
    content;

  return [
    {
      key: "identity",
      label: "identity",
      sub: "who · pitch",
      title: "Identity",
      body: (
        <div>
          <p style={{ marginTop: 0 }}>{profile.pitch}</p>
          <p>
            <B>Status:</B> {profile.availability}
          </p>
          <p>
            <B>Eligibility:</B> {profile.eligibility_note}
          </p>
          <p style={{ marginBottom: 0 }}>
            {profile.location_current} → {profile.location_target}
          </p>
        </div>
      ),
    },
    {
      key: "experience",
      label: "experience",
      sub: "gutes-set",
      title: "Experience",
      body: (
        <div>
          {experiences.map((e) => (
            <div key={e.id} style={{ marginBottom: 14 }}>
              <div>
                <B>
                  {e.company} — {e.role}
                </B>{" "}
                <span style={{ color: "var(--dim)" }}>
                  ({e.location}, {e.start}–{e.end})
                </span>
              </div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {e.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
          <div style={{ color: "var(--dim)" }}>
            Competitive: {competitive.lines.join(" ")}
          </div>
        </div>
      ),
    },
    {
      key: "stack",
      label: "stack",
      sub: "full-stack",
      title: "Stack",
      body: (
        <div>
          {skill_groups.map((g) => (
            <p key={g.id} style={{ margin: "0 0 8px" }}>
              <B>{g.label}</B> — {g.items.join(", ")}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: "projects",
      label: "projects",
      sub: `${projects.length} builds`,
      title: "Projects",
      body: (
        <div>
          {projects.map((p) => (
            <div key={p.id} style={{ marginBottom: 14 }}>
              <div>
                <B>{p.name}</B>{" "}
                <span style={{ color: "var(--dim)" }}>({p.period})</span>
              </div>
              <div>{p.description}</div>
              <div style={{ color: "var(--dim)", marginTop: 3 }}>
                {p.stack.join(" · ")}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "ai",
      label: "ai integration ◆",
      sub: "claude api",
      title: "AI integration",
      body: (
        <div>
          <p style={{ marginTop: 0 }}>
            <B>Building with the Claude API</B> — Anthropic certification: RAG,
            MCP, agents, tool use, prompt engineering.
          </p>
          <p>
            Shipped in <B>Lead-HQ</B>: an AI lead-scoring grader over scraped
            data. The differentiator — shipping AI features <B>end to end</B>,
            not just calling an API once.
          </p>
          <p style={{ marginBottom: 0, color: "var(--ai)" }}>
            ◆ This terminal is itself a live example — it runs on a real model
            grounded in my CV.
          </p>
        </div>
      ),
    },
    {
      key: "credentials",
      label: "credentials",
      sub: "certs · infos",
      title: "Credentials",
      body: (
        <div>
          <p style={{ marginTop: 0 }}>
            <B>Certifications</B>
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            {certifications.map((c) => (
              <li key={c.id}>
                {c.name} — {c.issuer} ({c.date})
                {c.note ? ` · ${c.note}` : ""}
              </li>
            ))}
          </ul>
          <p style={{ margin: "0 0 4px" }}>
            <B>Education</B>
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            {education.map((ed) => (
              <li key={ed.id}>
                {ed.institution} — {ed.focus}. {ed.credential_line} ({ed.period}
                )
              </li>
            ))}
          </ul>
          <p style={{ margin: 0 }}>
            <B>Competitive</B> — {competitive.lines.join(" ")}
          </p>
        </div>
      ),
    },
  ];
}

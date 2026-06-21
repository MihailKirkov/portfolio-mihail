import type { ReactNode } from "react";
import type { Content } from "@/lib/types";
import { SkillsRadar } from "@/components/hud/skills-radar";
import { CareerTimeline } from "@/components/hud/career-timeline";
import { LocationMap } from "@/components/hud/location-map";

export type SectionKey =
  | "identity"
  | "experience"
  | "stack"
  | "projects"
  | "timeline"
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
  const {
    profile,
    identity,
    experiences,
    skill_groups,
    projects,
    certifications,
    education,
    competitive,
    timeline,
  } = content;

  // proficiency per skill group — the same values the deck/visor gauges show
  const RADAR: { label: string; value: number }[] = [
    { label: "Frontend", value: 92 },
    { label: "Backend", value: 85 },
    { label: "Databases", value: 80 },
    { label: "AI integration", value: 78 },
    { label: "DevOps", value: 68 },
  ];

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
            <B>AI integration:</B> hands-on — Claude API, RAG, tool use and
            agents, shipped in production (not demos).
          </p>
          <p>
            <B>Status:</B> {profile.availability}
          </p>
          <p>
            <B>Eligibility:</B> {profile.eligibility_note}
          </p>
          <p>
            <B>About:</B> {identity.about}
          </p>
          <p className="funfact" style={{ marginBottom: 8 }}>
            {identity.fun_fact}
          </p>
          <LocationMap />
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
          <SkillsRadar axes={RADAR} />
          {skill_groups.map((g) => (
            <p key={g.id} style={{ margin: "0 0 8px" }}>
              <B>{g.label}</B> - {g.items.join(", ")}
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
      key: "timeline",
      label: "timeline",
      sub: "2004 → now",
      title: "Career Timeline",
      body: <CareerTimeline items={timeline} />,
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

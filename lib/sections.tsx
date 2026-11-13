import type { ReactNode } from "react";
import Image from "next/image";
import type { Certification, Content, Experience, TimelineEntry } from "@/lib/types";
import { agentId } from "@/lib/agent/targets";
import { TimelineDraw } from "@/components/site/timeline-draw";
import { Journey, type JourneyStep } from "@/components/site/journey";
import { StackLinks } from "@/components/site/stack-links";
import { StackStage } from "@/components/stack/stack-stage";
import { projectsUsing, TIERS, uniqueSkills } from "@/lib/skills";

// Renderers for the compact static sections below the projects. Every value
// comes from seed.json; nothing here may add facts of its own.

export type SectionKey = "stack" | "experience";

export interface Section {
  key: SectionKey;
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
  | { kind: "mark"; t: TimelineEntry; key: number }
  | { kind: "cert"; c: Certification; key: number };

/** roles, milestones and certifications on one line, newest first; a
 *  milestone that marks the start of a role (same id) is that role's node,
 *  not a second date */
function experienceTimeline(
  experiences: Experience[],
  timeline: TimelineEntry[],
  certifications: Certification[]
): TimelineNode[] {
  const roles = new Set(experiences.map((e) => e.id));
  const nodes: TimelineNode[] = [
    ...byOrder(experiences).map((e) => ({ kind: "role" as const, e, key: dateKey(e.start) })),
    ...byOrder(timeline)
      .filter((t) => !roles.has(t.id))
      .map((t) => ({ kind: "mark" as const, t, key: dateKey(t.date) })),
    ...byOrder(certifications).map((c) => ({ kind: "cert" as const, c, key: dateKey(c.date) })),
  ];
  // stable: equal dates keep roles before milestones, milestones before certifications
  return nodes.sort((a, b) => b.key - a.key);
}

export function buildSections(content: Content): Section[] {
  const {
    profile,
    projects,
    identity,
    experiences,
    skill_groups,
    certifications,
    education,
    competitive,
    timeline,
    languages,
  } = content;

  // a skill that appears in a project's stack links to the first such project
  const ordered = byOrder(projects);
  const projectFor = (skill: string) => projectsUsing(skill, ordered)[0]?.slug;
  const constellationProjects = ordered.map((p) => ({
    slug: p.slug,
    name: p.name,
    blurb: p.shortDescription,
    stack: p.stack,
  }));

  // the About gate's short facts (also in the fallback about block)
  const aboutFacts = [
    { label: "competitive", lines: competitive.lines },
    { label: "languages", lines: byOrder(languages).map((l) => `${l.name} / ${l.level}`) },
    {
      label: "education",
      lines: byOrder(education).map((ed) => `${ed.institution} / ${ed.period} - ${ed.credential_line}`),
    },
  ];

  // the journey: About first, then every step oldest first, newest last
  const yearOf = (d: string) => d.match(/\d{4}/)?.[0] ?? "";
  const journeySteps: JourneyStep[] = [
    {
      id: "about",
      year: "",
      label: "about",
      date: "",
      title: "About",
      text: identity.about,
      photo: { src: "/me.jpg", alt: `Photo of ${profile.name}` },
      facts: aboutFacts,
    },
    ...[...experienceTimeline(experiences, timeline, certifications)].reverse().map((n): JourneyStep =>
      n.kind === "cert"
        ? {
            id: `cert-${n.c.id}`,
            kind: "cert",
            year: yearOf(n.c.date),
            label: `${yearOf(n.c.date)} · cert`,
            date: n.c.date,
            title: n.c.name,
            role: n.c.issuer,
            text: n.c.note || undefined,
          }
        : n.kind === "role"
        ? {
            id: n.e.id,
            year: yearOf(n.e.start),
            label: `${yearOf(n.e.start)} · ${n.e.company}`,
            date: `${n.e.start} - ${n.e.end}`,
            start: n.e.start,
            title: n.e.company,
            role: n.e.role,
            bullets: n.e.bullets,
          }
        : {
            id: n.t.id,
            year: yearOf(n.t.date),
            label: yearOf(n.t.date),
            date: n.t.date,
            title: n.t.label,
          }
    ),
  ];
  journeySteps[0].year = journeySteps[1]?.year ?? "";

  return [
    {
      key: "stack",
      title: "Stack",
      body: (
        <StackLinks>
          <StackStage skills={uniqueSkills(skill_groups)} projects={constellationProjects}>
          <dl className="grid-list stack">
            <div className="grid-row stack-head" aria-hidden="true">
              <span />
              {TIERS.map((t) => (
                <span key={t} className="label">
                  {t}
                </span>
              ))}
            </div>
            {byOrder(skill_groups).map((g) => (
              <div key={g.id} className="grid-row stack-row" data-agent-id={agentId.stack(g.id)}>
                <dt className="label">{g.label}</dt>
                {TIERS.map((tier) => {
                  const items = g.items.filter((i) => i.tier === tier);
                  return (
                    <dd key={tier} className="stack-tier" data-empty={items.length === 0 || undefined}>
                      <span className="label stack-tier-label">{tier}</span>
                      <ul className="tags" aria-label={`${g.label}, ${tier}`}>
                        {items.map((i) => {
                          const slug = projectFor(i.name);
                          return (
                            <li key={i.name} className="tag" data-agent-id={agentId.skill(i.name)}>
                              {slug ? (
                                <a href={`#project-${slug}`} data-project={slug} className="tag-link">
                                  {i.name}
                                </a>
                              ) : (
                                // focusable so every skill is reachable by keyboard
                                <span tabIndex={0}>{i.name}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </dd>
                  );
                })}
              </div>
            ))}
          </dl>
          </StackStage>
        </StackLinks>
      ),
    },
    {
      key: "experience",
      title: "Experience",
      body: (
        <Journey steps={journeySteps}>
          {/* fallback: the about block, then the vertical timeline */}
          <div className="about">
            {/* public/me.jpg: a replaceable photo slot (3:4) */}
            <Image
              className="about-photo"
              src="/me.jpg"
              alt={`Photo of ${profile.name}`}
              width={240}
              height={320}
              sizes="(max-width: 767px) 96px, 180px"
            />
            <div className="about-text">
              <p>{identity.about}</p>
              <p className="muted">{identity.fun_fact}</p>
              <dl className="about-facts">
                {aboutFacts.map((f) => (
                  <div key={f.label}>
                    <dt className="label">{f.label}</dt>
                    {f.lines.map((l, i) => (
                      <dd key={i}>{l}</dd>
                    ))}
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <TimelineDraw>
            <ol className="xp-list">
              {experienceTimeline(experiences, timeline, certifications).map((n) =>
                n.kind === "cert" ? (
                  <li key={`cert-${n.c.id}`} className="xp-mark xp-cert" data-node="cert">
                    <span className="label">{n.c.date} · cert</span>
                    <span>
                      {n.c.name} <span className="muted">/ {n.c.issuer}</span>
                    </span>
                  </li>
                ) : n.kind === "role" ? (
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
        </Journey>
      ),
    },
  ];
}

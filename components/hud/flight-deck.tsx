"use client";

import type { Content } from "@/lib/types";
import type { Section, SectionKey } from "@/lib/sections";
import { Gauge } from "@/components/hud/gauge";
import { CssCore } from "@/components/hud/reactor-core";
import { Terminal } from "@/components/hud/terminal";
import { Brand, CvLink, Socials } from "@/components/hud/parts";

// Decorative capability values (HUD flourish, not claimed metrics).
const CAPABILITY = [
  { left: "frontend", right: "react/next/ts", value: 92 },
  { left: "backend", right: "node/php/py", value: 82 },
  { left: "ai integration", right: "claude/rag", value: 78 },
  { left: "devops", right: "docker/ci", value: 68 },
];

// Deck node positions keyed by section. The two columns hug the core with a
// subtle inward chevron (middle node sits closest to centre).
const NODE_POS: Record<
  SectionKey,
  { side: "l" | "r"; style: React.CSSProperties }
> = {
  identity: { side: "l", style: { left: 282, top: 56, width: 150 } },
  projects: { side: "r", style: { right: 282, top: 56, width: 150 } },
  experience: { side: "l", style: { left: 294, top: 116, width: 150 } },
  ai: { side: "r", style: { right: 294, top: 116, width: 150 } },
  stack: { side: "l", style: { left: 282, top: 176, width: 150 } },
  credentials: { side: "r", style: { right: 282, top: 176, width: 150 } },
};

export function FlightDeck({
  content,
  sections,
  onOpen,
  trigger,
}: {
  content: Content;
  sections: Section[];
  onOpen: (key: SectionKey) => void;
  trigger?: unknown;
}) {
  const { profile, languages, projects, certifications } = content;

  return (
    <div className="stage">
      <Brand profile={profile} />

      {/* top-right: pills + CV + socials */}
      <div className="topr" style={{ right: 0, top: 6 }}>
        <span className="mpill" style={{ margin: 0 }}>
          2+ yrs production
        </span>
        <span className="mpill" style={{ margin: 0 }}>
          available aug 2026
        </span>
        <span className="mpill" style={{ margin: 0 }}>
          eu citizen · no sponsorship
        </span>
        <CvLink profile={profile} />
        <Socials profile={profile} />
      </div>

      {/* left capability column */}
      <div
        className="panel"
        style={{ left: 0, top: 60, width: 230, height: 316, padding: 14 }}
      >
        <div className="head">capability</div>
        {CAPABILITY.map((c) => (
          <Gauge key={c.left} {...c} trigger={trigger} />
        ))}
        <div className="head" style={{ marginTop: 14 }}>
          languages
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.95, color: "var(--dim)" }}>
          {languages.map((l) => (
            <div key={l.id}>
              {l.name}{" "}
              <b
                style={{
                  color:
                    l.level === "basic" ? "var(--faint)" : "var(--bright)",
                  fontWeight: 400,
                }}
              >
                {l.level}
              </b>
            </div>
          ))}
        </div>
      </div>
      {/* bottom-left: clean availability status (single intentional block) */}
      <div className="read" style={{ left: 0, top: 392, width: 230 }}>
        <div className="head">status</div>
        <div>
          <span className="on1">●</span> available aug 2026
        </div>
        <div>vienna → eindhoven · sept 2026</div>
      </div>

      {/* center core — the signature element */}
      <div
        className="core"
        style={{
          left: "50%",
          top: 52,
          width: 168,
          height: 168,
          transform: "translateX(-50%)",
        }}
      >
        <CssCore size={168} rings={2} sweep />
      </div>

      {/* six nodes */}
      {sections.map((s) => {
        const pos = NODE_POS[s.key];
        const cls = `node${pos.side === "r" ? " r" : ""}${
          s.key === "ai" ? " ai" : ""
        }`;
        return (
          <button
            key={s.key}
            className={cls}
            style={pos.style}
            onClick={() => onOpen(s.key)}
          >
            {s.label}
          </button>
        );
      })}

      {/* terminal — contained height; the log scrolls internally as it grows */}
      <div
        className="panel term"
        style={{ left: 250, right: 250, top: 256, height: 236 }}
      >
        <Terminal config={content.terminal} />
      </div>

      {/* right status column */}
      <div
        className="panel"
        style={{ right: 0, top: 60, width: 230, height: 316, padding: 14 }}
      >
        <div className="head">project status</div>
        {projects.map((p) => (
          <div
            key={p.id}
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--ink)",
              marginTop: 5,
            }}
          >
            <span className="on1">●</span> {p.name.toLowerCase()}{" "}
            <span style={{ color: "var(--dim)" }}>{p.stack[0]}</span>
          </div>
        ))}
        <div className="head" style={{ marginTop: 14 }}>
          certified
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.45 }}>
          {certifications.map((c) => (
            <div key={c.id} style={{ marginTop: 6 }}>
              <span style={{ color: "var(--bright)" }}>{c.name}</span>
              <span style={{ color: "var(--faint)" }}> · {c.issuer}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="read"
        style={{ right: 0, top: 392, width: 230, textAlign: "right" }}
      >
        <div className="head">comms</div>
        <a className="btn-ghost" href={`mailto:${profile.email}`}>
          book a call
        </a>
      </div>
    </div>
  );
}

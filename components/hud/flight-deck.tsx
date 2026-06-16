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

// Deck node positions keyed by section. Two columns flank the core in three
// rows, with a subtle inward chevron (middle node sits closest to centre).
const NODE_POS: Record<
  SectionKey,
  { side: "l" | "r"; style: React.CSSProperties }
> = {
  identity: { side: "l", style: { left: 250, top: 62, width: 168 } },
  projects: { side: "r", style: { right: 250, top: 62, width: 168 } },
  experience: { side: "l", style: { left: 262, top: 146, width: 168 } },
  ai: { side: "r", style: { right: 262, top: 146, width: 168 } },
  stack: { side: "l", style: { left: 250, top: 230, width: 168 } },
  credentials: { side: "r", style: { right: 250, top: 230, width: 168 } },
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
        style={{ left: 0, top: 56, width: 240, height: 408, padding: 16 }}
      >
        <div className="head">capability</div>
        {CAPABILITY.map((c) => (
          <Gauge key={c.left} {...c} trigger={trigger} />
        ))}
        <div className="head" style={{ marginTop: 18 }}>
          languages
        </div>
        <div style={{ fontSize: 12, lineHeight: 2.1, color: "var(--dim)" }}>
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
        <div className="head" style={{ marginTop: 18 }}>
          focus
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--dim)" }}>
          frontend polish ·{" "}
          <span style={{ color: "var(--bright)" }}>ai integration</span>
        </div>
      </div>
      {/* bottom-left: clean availability status (single intentional block) */}
      <div className="read" style={{ left: 0, top: 480, width: 240 }}>
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
          top: 58,
          width: 200,
          height: 200,
          transform: "translateX(-50%)",
        }}
      >
        <CssCore size={200} rings={3} sweep />
      </div>

      {/* six nodes — label + sublabel for presence */}
      {sections.map((s) => {
        const pos = NODE_POS[s.key];
        const cls = `node${pos.side === "r" ? " r" : ""}${
          s.key === "ai" ? " ai" : ""
        }`;
        return (
          <button
            key={s.key}
            className={cls}
            style={{ ...pos.style, padding: "11px 13px" }}
            onClick={() => onOpen(s.key)}
          >
            <div>{s.label}</div>
            <div className="k">{s.sub}</div>
          </button>
        );
      })}

      {/* terminal — substantial; the log scrolls internally as it grows */}
      <div
        className="panel term"
        style={{ left: 256, right: 256, top: 296, bottom: 38 }}
      >
        <Terminal config={content.terminal} />
      </div>

      {/* right status column */}
      <div
        className="panel"
        style={{ right: 0, top: 56, width: 240, height: 408, padding: 16 }}
      >
        <div className="head">project status</div>
        {projects.map((p) => (
          <div
            key={p.id}
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            <span className="on1">●</span> {p.name.toLowerCase()}{" "}
            <span style={{ color: "var(--dim)" }}>{p.stack[0]}</span>
          </div>
        ))}
        <div className="head" style={{ marginTop: 18 }}>
          certified
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          {certifications.map((c) => (
            <div key={c.id} style={{ marginTop: 7 }}>
              <span style={{ color: "var(--bright)" }}>{c.name}</span>
              <span style={{ color: "var(--faint)" }}> · {c.issuer}</span>
            </div>
          ))}
        </div>
        <div className="head" style={{ marginTop: 18 }}>
          background
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--dim)" }}>
          bulgarian national
          <br />
          informatics team &apos;19
        </div>
      </div>
      <div
        className="read"
        style={{ right: 0, top: 480, width: 240, textAlign: "right" }}
      >
        <div className="head">comms</div>
        <a className="btn-ghost" href={`mailto:${profile.email}`}>
          book a call
        </a>
      </div>
    </div>
  );
}

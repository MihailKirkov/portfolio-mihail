"use client";

import type { Content } from "@/lib/types";
import type { Section, SectionKey } from "@/lib/sections";
import { Gauge } from "@/components/hud/gauge";
import { CssCore } from "@/components/hud/reactor-core";
import { Terminal } from "@/components/hud/terminal";
import { Brand, CvLink, Socials } from "@/components/hud/parts";

// Visor flourish gauges (decorative HUD readouts, not claimed metrics).
const PROFICIENCY = [
  { left: "react/next", value: 92 },
  { left: "node · php", value: 80 },
  { left: "ai integ", value: 78 },
];

export function Visor({
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
  const { profile } = content;

  return (
    <div className="stage">
      <Brand profile={profile} />
      <div className="topr" style={{ right: 0, top: 6 }}>
        <CvLink profile={profile} />
        <Socials profile={profile} />
      </div>

      {/* visor frame brackets */}
      <div
        className="bracket"
        style={{
          top: 54,
          left: 0,
          width: 150,
          height: 104,
          borderTop: "2px solid var(--edge)",
          borderLeft: "2px solid var(--edge)",
          borderTopLeftRadius: 84,
        }}
      />
      <div
        className="bracket"
        style={{
          top: 54,
          right: 0,
          width: 150,
          height: 104,
          borderTop: "2px solid var(--edge)",
          borderRight: "2px solid var(--edge)",
          borderTopRightRadius: 84,
        }}
      />
      <div
        className="bracket"
        style={{
          bottom: 0,
          left: 0,
          width: 150,
          height: 120,
          borderBottom: "2px solid var(--edge)",
          borderLeft: "2px solid var(--edge)",
          borderBottomLeftRadius: 84,
        }}
      />
      <div
        className="bracket"
        style={{
          bottom: 0,
          right: 0,
          width: 150,
          height: 120,
          borderBottom: "2px solid var(--edge)",
          borderRight: "2px solid var(--edge)",
          borderBottomRightRadius: 84,
        }}
      />

      {/* corner readouts */}
      <div className="read" style={{ top: 64, left: 22 }}>
        <div className="on1">● secure link</div>
        <div>
          sys ▮▮▮▮▮ <b>100%</b>
        </div>
        <div>
          exp <b>2+ yrs</b>
        </div>
      </div>
      <div className="read" style={{ top: 64, right: 22, textAlign: "right" }}>
        <div>vienna → eindhoven</div>
        <div>
          available <b>aug 2026</b>
        </div>
        <div>eu · no sponsor</div>
      </div>

      {/* bottom-left proficiency gauges */}
      <div className="read" style={{ bottom: 40, left: 22, width: 150 }}>
        <div className="head">proficiency</div>
        {PROFICIENCY.map((g) => (
          <Gauge key={g.left} {...g} trigger={trigger} />
        ))}
      </div>

      {/* bottom-right comms */}
      <div
        className="read"
        style={{ bottom: 40, right: 22, width: 160, textAlign: "right" }}
      >
        <div className="head">comms</div>
        <div style={{ lineHeight: 2 }}>
          <a
            className="ico"
            href={profile.social.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            github ↗
          </a>
          <br />
          <a
            className="ico"
            href={profile.social.linkedin}
            target="_blank"
            rel="noopener noreferrer"
          >
            linkedin ↗
          </a>
          <br />
          <a
            className="ico"
            href={profile.social.portfolio}
            target="_blank"
            rel="noopener noreferrer"
          >
            portfolio ↗
          </a>
        </div>
        <a
          className="btn-ghost"
          style={{ marginTop: 4 }}
          href={`mailto:${profile.email}`}
        >
          book a call
        </a>
      </div>

      {/* center core */}
      <div
        className="core"
        style={{
          left: "50%",
          top: 60,
          width: 96,
          height: 96,
          transform: "translateX(-50%)",
        }}
      >
        <CssCore size={96} rings={2} />
      </div>

      {/* nodes — 3-column grid under the core */}
      <div
        style={{
          position: "absolute",
          left: 208,
          right: 208,
          top: 172,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {sections.map((s) => (
          <button
            key={s.key}
            className={`node${s.key === "ai" ? " ai" : ""}`}
            style={{ position: "relative", width: "auto" }}
            onClick={() => onOpen(s.key)}
          >
            <div>{s.label}</div>
            <div className="k">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* terminal — sits below the two-row node grid */}
      <div
        className="panel term"
        style={{ left: 208, right: 208, top: 290, bottom: 40 }}
      >
        <Terminal config={content.terminal} />
      </div>
    </div>
  );
}

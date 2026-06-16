"use client";

import type { Content } from "@/lib/types";
import type { Section, SectionKey } from "@/lib/sections";
import { CssCore } from "@/components/hud/reactor-core";
import { Terminal } from "@/components/hud/terminal";
import { Brand, CvLink, Socials } from "@/components/hud/parts";

// Reactor node positions keyed by section — six nodes orbiting the core, each
// wired to the core by an SVG conduit line below.
const NODE_POS: Record<
  SectionKey,
  { side: "l" | "r"; style: React.CSSProperties }
> = {
  identity: { side: "l", style: { left: 170, top: 88, width: 170 } },
  projects: { side: "r", style: { right: 170, top: 88, width: 170 } },
  experience: { side: "l", style: { left: 8, top: 202, width: 160 } },
  ai: { side: "r", style: { right: 8, top: 202, width: 160 } },
  stack: { side: "l", style: { left: 170, top: 316, width: 170 } },
  credentials: { side: "r", style: { right: 170, top: 316, width: 170 } },
};

export function Reactor({
  content,
  sections,
  onOpen,
}: {
  content: Content;
  sections: Section[];
  onOpen: (key: SectionKey) => void;
}) {
  const { profile } = content;

  return (
    <div className="stage">
      <Brand profile={profile} />
      <div className="topr" style={{ right: 0, top: 6 }}>
        <CvLink profile={profile} />
        <Socials profile={profile} />
      </div>

      {/* corner readouts */}
      <div className="read" style={{ top: 58, left: 6 }}>
        <div className="on1">● secure</div>
        <div>2+ yrs prod</div>
        <div>10+ modules</div>
      </div>
      <div className="read" style={{ top: 58, right: 6, textAlign: "right" }}>
        <div>available aug</div>
        <div>eu citizen</div>
        <div>no sponsor</div>
      </div>

      {/* conduit lines from core to each node */}
      <svg
        viewBox="0 0 1080 360"
        style={{ position: "absolute", top: 58, left: 0, width: 1080, height: 360 }}
        aria-hidden="true"
      >
        <g stroke="#163e63" strokeWidth="1" fill="none">
          <line x1="540" y1="180" x2="250" y2="60" />
          <line x1="540" y1="180" x2="830" y2="60" />
          <line x1="540" y1="180" x2="120" y2="180" />
          <line x1="540" y1="180" x2="960" y2="180" />
          <line x1="540" y1="180" x2="250" y2="300" />
          <line x1="540" y1="180" x2="830" y2="300" />
        </g>
      </svg>

      {/* center core — full three-ring signature */}
      <div
        className="core"
        style={{
          left: "50%",
          top: 148,
          width: 150,
          height: 150,
          transform: "translateX(-50%)",
          zIndex: 2,
        }}
      >
        <CssCore size={150} rings={3} sweep label="M.KIRKOV" role="full-stack" />
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
            style={{ ...pos.style, zIndex: 3 }}
            onClick={() => onOpen(s.key)}
          >
            {s.label}
          </button>
        );
      })}

      {/* decorative orbiters + equalizer */}
      <div
        className="deco"
        style={{
          left: 24,
          bottom: 120,
          width: 54,
          height: 54,
          animation: "spinr 18s linear infinite",
        }}
      />
      <div
        className="deco"
        style={{
          right: 24,
          bottom: 120,
          width: 54,
          height: 54,
          borderStyle: "dashed",
          animation: "spin 22s linear infinite",
        }}
      />
      <div className="wave" style={{ left: 300, bottom: 92, height: 22 }}>
        {[0, 0.1, 0.2, 0.05, 0.3, 0.15, 0.25, 0.08].map((d, i) => (
          <i key={i} style={{ animationDelay: `${d}s` }} />
        ))}
      </div>

      {/* terminal */}
      <div
        className="panel term"
        style={{ left: 8, right: 8, top: 420, bottom: 8 }}
      >
        <Terminal config={content.terminal} />
      </div>
    </div>
  );
}

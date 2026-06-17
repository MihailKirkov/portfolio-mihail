"use client";

// Mode-specific "chrome": the decorative panels, brackets, conduit lines and
// readouts unique to each layout. These fade/scale in (staggered after the
// nodes settle) and out via AnimatePresence in <Stage>. The persistent elements
// (core, nodes, terminal, brand, socials) live in <Stage>, not here.

import type { Content } from "@/lib/types";
import { Gauge } from "@/components/hud/gauge";

// ---- Flight Deck: gauge + status columns ---------------------------------
export function DeckChrome({ content }: { content: Content }) {
  const { profile, languages, projects, certifications } = content;
  const CAPABILITY = [
    { left: "frontend", right: "react/next/ts", value: 92 },
    { left: "backend", right: "node/php/py", value: 82 },
    { left: "ai integration", right: "claude/rag", value: 78 },
    { left: "devops", right: "docker/ci", value: 68 },
  ];
  return (
    <>
      {/* deck-only credibility pills, sitting left of the persistent CV/socials */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 152,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span className="mpill" style={{ margin: 0 }}>
          2+ yrs production
        </span>
        <span className="mpill" style={{ margin: 0 }}>
          available aug 2026
        </span>
        <span className="mpill" style={{ margin: 0 }}>
          eu citizen · no sponsorship
        </span>
      </div>

      <div
        className="card panel"
        style={{ left: 0, top: 56, width: 240, height: 408, padding: 16 }}
      >
        <div className="head">capability</div>
        {CAPABILITY.map((c) => (
          <Gauge key={c.left} {...c} />
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
                    l.level === "basic" ? "var(--dim)" : "var(--bright)",
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
      <div className="read" style={{ left: 0, top: 480, width: 240 }}>
        <div className="head">status</div>
        <div>
          <span className="on1">●</span> available aug 2026
        </div>
        <div>vienna → eindhoven · sept 2026</div>
      </div>

      <div
        className="card panel"
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
        <div style={{ fontSize: 11, lineHeight: 1.32 }}>
          {certifications.map((c) => (
            <div key={c.id} style={{ marginTop: 8 }}>
              <div style={{ color: "var(--bright)" }}>{c.name}</div>
              <div style={{ color: "var(--dim)" }}>· {c.issuer}</div>
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
    </>
  );
}

// ---- Visor: frame brackets + corner readouts -----------------------------
const PROFICIENCY = [
  { left: "react/next", value: 92 },
  { left: "node · php", value: 80 },
  { left: "ai integ", value: 78 },
];

export function VisorChrome({ content }: { content: Content }) {
  const { profile } = content;
  const bracket = (s: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    ...s,
  });
  return (
    <>
      <div
        className="bracket"
        style={bracket({
          top: 54,
          left: 0,
          width: 150,
          height: 104,
          borderTop: "2px solid var(--edge)",
          borderLeft: "2px solid var(--edge)",
          borderTopLeftRadius: 84,
        })}
      />
      <div
        className="bracket"
        style={bracket({
          top: 54,
          right: 0,
          width: 150,
          height: 104,
          borderTop: "2px solid var(--edge)",
          borderRight: "2px solid var(--edge)",
          borderTopRightRadius: 84,
        })}
      />
      <div
        className="bracket"
        style={bracket({
          bottom: 0,
          left: 0,
          width: 150,
          height: 120,
          borderBottom: "2px solid var(--edge)",
          borderLeft: "2px solid var(--edge)",
          borderBottomLeftRadius: 84,
        })}
      />
      <div
        className="bracket"
        style={bracket({
          bottom: 0,
          right: 0,
          width: 150,
          height: 120,
          borderBottom: "2px solid var(--edge)",
          borderRight: "2px solid var(--edge)",
          borderBottomRightRadius: 84,
        })}
      />

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

      {/* flank radar dials echoing the reference HUD's side instruments */}
      <div className="radar" style={{ top: 182, left: 30 }} aria-hidden="true">
        <span className="radar-sweep" />
        <span className="radar-blip" />
        <span className="radar-lbl">scan</span>
      </div>
      <div className="radar" style={{ top: 182, right: 30 }} aria-hidden="true">
        <span className="radar-sweep" />
        <span className="radar-blip" />
        <span className="radar-lbl">net</span>
      </div>

      <div className="read" style={{ bottom: 40, left: 22, width: 150 }}>
        <div className="head">proficiency</div>
        {PROFICIENCY.map((g) => (
          <Gauge key={g.left} {...g} />
        ))}
      </div>
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
          <a className="ico" href={`mailto:${profile.email}`}>
            email ↗
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
    </>
  );
}

// ---- Reactor: conduit lines + orbiters + readouts ------------------------
export function ReactorChrome() {
  return (
    <>
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

      <svg
        viewBox="0 0 1080 360"
        style={{
          position: "absolute",
          top: 58,
          left: 0,
          width: 1080,
          height: 360,
        }}
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

      <div
        className="deco"
        aria-hidden="true"
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
        aria-hidden="true"
        style={{
          right: 24,
          bottom: 120,
          width: 54,
          height: 54,
          borderStyle: "dashed",
          animation: "spin 22s linear infinite",
        }}
      />
      <div
        className="wave"
        aria-hidden="true"
        style={{ left: 300, bottom: 92, height: 22 }}
      >
        {[0, 0.1, 0.2, 0.05, 0.3, 0.15, 0.25, 0.08].map((d, i) => (
          <i key={i} style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
    </>
  );
}

import { ImageResponse } from "next/og";
import { seedContent } from "@/lib/content";
import { CORE_STILL_VIEW, coreStill } from "@/lib/core/still";

// Social card, reused for Open Graph and Twitter (twitter-image.tsx). Rendered
// once at build. Copy comes from content/seed.json; the core is the same
// static still the hero falls back to. The accent marks agent activity only:
// the cursor and the tool call.

const { profile } = seedContent;

export const alt = `${profile.name} - ${profile.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// v3 tokens (app/globals.css)
const GROUND = "#0a0b0d";
const PANEL = "#111317";
const HAIRLINE = "#23272e";
const BORDER = "#3a3f47";
const TEXT = "#e8eaed";
const MUTED = "#a3a9b3";
const ACCENT = "#c8f542"; // keep in step with --accent

/** a Google font as TTF, subset to the text it draws; null if offline */
async function font(family: string, weight: number, text: string) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    return { name: family, data: await (await fetch(src)).arrayBuffer(), weight: weight as 500, style: "normal" as const };
  } catch {
    return null;
  }
}

const CALL = 'scroll_to("projects")';

export default async function Image() {
  const { faces, edges, rings } = coreStill();
  const display = `${profile.headline}${profile.name}`;
  const mono = `${profile.tagline}MKask-mihail${CALL}›`;
  const fonts = (
    await Promise.all([font("Space Grotesk", 500, display), font("JetBrains Mono", 400, mono)])
  ).filter((f) => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: GROUND,
          color: TEXT,
          fontFamily: "Space Grotesk",
          padding: 64,
          position: "relative",
        }}
      >
        {/* left: who, the headline, the command bar */}
        <div style={{ display: "flex", flexDirection: "column", width: 640, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "JetBrains Mono" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                border: `1px solid ${BORDER}`,
                fontSize: 16,
              }}
            >
              MK
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 1 }}>
              {profile.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 56,
              fontSize: 70,
              lineHeight: 1.04,
              letterSpacing: -2.5,
            }}
          >
            {profile.headline}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: "JetBrains Mono",
              fontSize: 16,
              color: MUTED,
            }}
          >
            {profile.tagline}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: "auto",
              padding: "18px 22px",
              border: `1px solid ${BORDER}`,
              background: PANEL,
              fontFamily: "JetBrains Mono",
              fontSize: 22,
            }}
          >
            <div style={{ display: "flex", color: MUTED }}>ask-mihail</div>
            <div style={{ display: "flex", width: 1, height: 26, background: HAIRLINE }} />
            <div style={{ display: "flex", color: ACCENT }}>› {CALL}</div>
          </div>
        </div>

        {/* right: the core, with the agent's cursor on it */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 8,
            top: 85,
            width: 460,
            height: 460,
          }}
        >
          <svg width={460} height={460} viewBox={`0 0 ${CORE_STILL_VIEW} ${CORE_STILL_VIEW}`}>
            {faces.map((p) => (
              <path key={p.color} d={p.d} fill={p.color} />
            ))}
            {edges.map((p) => (
              <path key={p.color} d={p.d} stroke={p.color} fill="none" strokeLinejoin="round" />
            ))}
            {rings.map((p, i) => (
              <path key={i} d={p.d} stroke={p.color} strokeWidth={p.width} fill="none" strokeOpacity={0.9} />
            ))}
          </svg>
          <svg
            width={40}
            height={48}
            viewBox="0 0 20 24"
            style={{ position: "absolute", left: 112, top: 300 }}
          >
            <path d="M1 1 L1 19 L6 14.5 L9.5 22 L12.5 20.6 L9 13.2 L15.5 13 Z" fill={ACCENT} stroke={GROUND} strokeWidth={1.2} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}

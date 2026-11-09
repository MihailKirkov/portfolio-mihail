import { ImageResponse } from "next/og";

// Social card, reused for Open Graph and Twitter. Interim v3 restyle; the
// final card is a phase 6 task.
export const alt = "Mihail Kirkov - Full-stack developer · AI integration";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#0a0b0d";
const BORDER = "#3a3f47";
const TEXT = "#e8eaed";
const MUTED = "#a3a9b3";

export default function Image() {
  const pills = ["2+ yrs production", "EU citizen"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: GROUND,
          color: TEXT,
          fontFamily: "sans-serif",
          padding: "0 96px",
          border: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 2,
            color: MUTED,
            marginBottom: 24,
          }}
        >
          portfolio-mihail
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 112,
            fontWeight: 500,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          Mihail Kirkov
        </div>

        <div style={{ display: "flex", fontSize: 38, color: MUTED, marginTop: 24 }}>
          Full-stack developer · AI integration
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
          {pills.map((p) => (
            <div
              key={p}
              style={{
                display: "flex",
                fontSize: 26,
                color: TEXT,
                border: `1px solid ${BORDER}`,
                padding: "10px 20px",
              }}
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}

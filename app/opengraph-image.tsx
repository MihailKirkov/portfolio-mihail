import { ImageResponse } from "next/og";

// Cold-blue HUD social card, reused for Open Graph and Twitter.
export const alt =
  "Mihail Kirkov — Full-stack developer · AI integration";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#5ad6ff";
const BG = "#04080f";

function Bracket({
  pos,
}: {
  pos: "tl" | "tr" | "bl" | "br";
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 64,
    height: 64,
    borderColor: ACCENT,
    opacity: 0.7,
  };
  const map: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 40, left: 40, borderTop: "3px solid", borderLeft: "3px solid" },
    tr: { top: 40, right: 40, borderTop: "3px solid", borderRight: "3px solid" },
    bl: {
      bottom: 40,
      left: 40,
      borderBottom: "3px solid",
      borderLeft: "3px solid",
    },
    br: {
      bottom: 40,
      right: 40,
      borderBottom: "3px solid",
      borderRight: "3px solid",
    },
  };
  return <div style={{ ...base, ...map[pos] }} />;
}

export default function Image() {
  const pills = [
    "2+ yrs production",
    "EU citizen",
    "available Aug 2026",
    "Eindhoven",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: `radial-gradient(120% 120% at 50% 0%, #0a1626 0%, ${BG} 60%)`,
          color: "#dff3ff",
          fontFamily: "sans-serif",
          position: "relative",
          padding: "0 96px",
        }}
      >
        {/* faint ring motif */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            top: -260,
            right: -180,
            width: 760,
            height: 760,
            borderRadius: "50%",
            border: `2px solid ${ACCENT}`,
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: "absolute",
            display: "flex",
            top: -160,
            right: -80,
            width: 560,
            height: 560,
            borderRadius: "50%",
            border: `2px solid ${ACCENT}`,
            opacity: 0.08,
          }}
        />

        <Bracket pos="tl" />
        <Bracket pos="tr" />
        <Bracket pos="bl" />
        <Bracket pos="br" />

        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 8,
            color: ACCENT,
            opacity: 0.85,
            marginBottom: 18,
          }}
        >
ASK-MIHAIL // PORTFOLIO
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: 4,
            lineHeight: 1,
            textShadow: `0 0 40px ${ACCENT}55`,
          }}
        >
          MIHAIL KIRKOV
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 38,
            color: "#9cc4dd",
            marginTop: 22,
          }}
        >
          Full-stack developer · AI integration
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 44 }}>
          {pills.map((p) => (
            <div
              key={p}
              style={{
                display: "flex",
                fontSize: 26,
                color: ACCENT,
                border: `1px solid ${ACCENT}66`,
                borderRadius: 6,
                padding: "10px 20px",
                background: `${ACCENT}11`,
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

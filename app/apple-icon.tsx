import { ImageResponse } from "next/og";

// Apple touch icon - same MK monogram, sized for home-screen bookmarks.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 120% at 50% 0%, #0a1626 0%, #04080f 65%)",
          color: "#5ad6ff",
          fontSize: 92,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: 4,
          textShadow: "0 0 24px #5ad6ff66",
        }}
      >
        MK
      </div>
    ),
    { ...size }
  );
}

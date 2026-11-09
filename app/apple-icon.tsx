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
          background: "#0a0b0d",
          color: "#e8eaed",
          fontSize: 92,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: 4,
        }}
      >
        MK
      </div>
    ),
    { ...size }
  );
}

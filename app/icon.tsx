import { ImageResponse } from "next/og";

// "MK" monogram favicon on the v3 ground colour.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: 1,
          border: "1.5px solid #e8eaed",
          borderRadius: 0,
        }}
      >
        MK
      </div>
    ),
    { ...size }
  );
}

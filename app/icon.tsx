import { ImageResponse } from "next/og";

// "MK" monogram favicon — cold-blue on dark navy, matching the in-app brand.
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
          background: "#04080f",
          color: "#5ad6ff",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: 1,
          border: "1.5px solid #5ad6ff",
          borderRadius: 6,
        }}
      >
        MK
      </div>
    ),
    { ...size }
  );
}

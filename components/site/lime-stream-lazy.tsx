"use client";

import dynamic from "next/dynamic";

// Decorative background, never needed for first paint: its own chunk.
export const LimeStream = dynamic(
  () => import("@/components/site/lime-stream").then((m) => m.LimeStream),
  { ssr: false }
);

"use client";

import dynamic from "next/dynamic";

// Decorative, never needed for first paint: loads in its own chunk.
export const PointerEffects = dynamic(
  () => import("@/components/site/pointer-effects").then((m) => m.PointerEffects),
  { ssr: false }
);

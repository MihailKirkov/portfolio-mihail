"use client";

import dynamic from "next/dynamic";

// The cursor overlay (and Framer Motion with it) is decorative and never needed
// for first paint, so it loads in its own chunk. Until it arrives the engine
// still runs every action, just without the flight.
export const CursorLayer = dynamic(
  () => import("@/components/agent/cursor").then((m) => m.CursorLayer),
  { ssr: false }
);

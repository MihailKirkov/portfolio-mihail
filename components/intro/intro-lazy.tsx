"use client";

import dynamic from "next/dynamic";

// The intro choreography loads in its own chunk after first paint; the boot
// script in <head> has already decided whether it plays.
export const BootIntro = dynamic(
  () => import("@/components/intro/boot-intro").then((m) => m.BootIntro),
  { ssr: false }
);

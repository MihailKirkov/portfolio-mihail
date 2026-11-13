"use client";

import { useEffect } from "react";
import { initScroll } from "@/lib/scroll";

/** starts the page's one scroll source (lib/scroll.ts) */
export function SmoothScroll() {
  useEffect(() => initScroll(), []);
  return null;
}

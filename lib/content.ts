import "server-only";
import seed from "@/content/seed.json";
import type { Content } from "@/lib/types";

/**
 * content/seed.json is the single source of truth for the public site. It is
 * committed and bundled into the build, so the site renders with zero external
 * services and zero env vars required.
 */
export const seedContent = seed as Content;

/**
 * getContent returns the bundled content. It is async so call sites (server
 * components, build-time generation) don't change if a live source is ever
 * reintroduced.
 */
export async function getContent(): Promise<Content> {
  return seedContent;
}

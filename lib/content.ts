import "server-only";
import seed from "@/content/seed.json";
import type { Content } from "@/lib/types";

/**
 * The bundled seed is the ground-truth fallback. It is committed and shipped
 * inside the build, so the public site renders even if Supabase is paused.
 */
export const seedContent = seed as Content;

/**
 * getContent tries to read live content from Supabase. On ANY error or timeout
 * it returns the bundled seed instead. It never throws — public pages depend on
 * this being safe to call at build time with no live DB.
 *
 * Supabase wiring is added in a later step; until env vars are present this
 * deliberately short-circuits to the seed so the static build always succeeds.
 */
export async function getContent(): Promise<Content> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return seedContent;
  }

  try {
    const { fetchContentFromSupabase } = await import("@/lib/supabase-content");
    const live = await fetchContentFromSupabase();
    return live ?? seedContent;
  } catch {
    return seedContent;
  }
}

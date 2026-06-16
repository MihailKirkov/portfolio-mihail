import "server-only";
import { createClient } from "@supabase/supabase-js";
import { seedContent } from "@/lib/content";
import type { Content } from "@/lib/types";

// Build-time / admin-side read of live content from Supabase using the service
// role key (server only). Returns null on any problem so getContent() falls back
// to the bundled seed. This is the only place that touches the live DB for the
// public site, and it never runs on a public client request.

const TIMEOUT_MS = 4000;

function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("supabase timeout")), TIMEOUT_MS)
    ),
  ]);
}

export async function fetchContentFromSupabase(): Promise<Content | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false },
    });

    const [
      profileRes,
      experiencesRes,
      projectsRes,
      skillGroupsRes,
      certificationsRes,
      educationRes,
      competitiveRes,
      languagesRes,
    ] = await withTimeout(
      Promise.all([
        db.from("profile").select("*").single(),
        db.from("experiences").select("*").order("sort_order"),
        db.from("projects").select("*").order("sort_order"),
        db.from("skill_groups").select("*").order("sort_order"),
        db.from("certifications").select("*").order("sort_order"),
        db.from("education").select("*").order("sort_order"),
        db.from("competitive").select("*").single(),
        db.from("languages").select("*").order("sort_order"),
      ])
    );

    if (profileRes.error || !profileRes.data) return null;
    const p = profileRes.data as Record<string, unknown>;

    const content: Content = {
      profile: {
        name: String(p.name ?? seedContent.profile.name),
        title: String(p.title ?? seedContent.profile.title),
        tagline: String(p.tagline ?? seedContent.profile.tagline),
        summary: String(p.summary ?? seedContent.profile.summary),
        pitch: String(p.pitch ?? seedContent.profile.pitch),
        location_current: String(
          p.location_current ?? seedContent.profile.location_current
        ),
        location_target: String(
          p.location_target ?? seedContent.profile.location_target
        ),
        availability: String(p.availability ?? seedContent.profile.availability),
        eligibility_note: String(
          p.eligibility_note ?? seedContent.profile.eligibility_note
        ),
        email: String(p.email ?? seedContent.profile.email),
        phone: (p.phone as string | null) ?? null,
        cv_url: String(p.cv_url ?? seedContent.profile.cv_url),
        social: {
          github: String(p.github ?? seedContent.profile.social.github),
          linkedin: String(p.linkedin ?? seedContent.profile.social.linkedin),
          portfolio: String(p.portfolio ?? seedContent.profile.social.portfolio),
        },
      },
      experiences: (experiencesRes.data ?? seedContent.experiences) as Content["experiences"],
      projects: (projectsRes.data ?? seedContent.projects) as Content["projects"],
      skill_groups: (skillGroupsRes.data ?? seedContent.skill_groups) as Content["skill_groups"],
      certifications: (certificationsRes.data ?? seedContent.certifications) as Content["certifications"],
      education: (educationRes.data ?? seedContent.education) as Content["education"],
      competitive: (competitiveRes.data ?? seedContent.competitive) as Content["competitive"],
      languages: (languagesRes.data ?? seedContent.languages) as Content["languages"],
      // terminal config is not a DB table — always from the bundled seed
      terminal: seedContent.terminal,
    };

    return content;
  } catch {
    return null;
  }
}

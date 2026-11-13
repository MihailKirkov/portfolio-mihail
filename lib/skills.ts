import type { Project, SkillGroup, SkillTier } from "@/lib/types";

// Skills and the projects that use them. A skill matches a project stack tag
// when one names the other ("Next.js" / "Next.js 15", "Tailwind" /
// "Tailwind CSS", "Claude API" / "ClaudeAPI"); short names must match exactly
// so "Git" never matches "GitHub".

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function skillMatchesTag(skill: string, tag: string) {
  const a = norm(skill);
  const b = norm(tag);
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/** projects (in the given order) whose stack includes the skill */
export function projectsUsing<P extends Pick<Project, "stack">>(skill: string, projects: P[]) {
  return projects.filter((p) => p.stack.some((t) => skillMatchesTag(skill, t)));
}

/** url-safe key for a skill name, used in its agent id */
export function skillKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const TIERS: SkillTier[] = ["daily", "shipped with", "familiar"];

export interface SkillNode {
  name: string;
  key: string;
  tier: SkillTier;
  group: string;
  groupLabel: string;
}

/** every skill once (the first group that lists it), in group order */
export function uniqueSkills(groups: SkillGroup[]): SkillNode[] {
  const seen = new Set<string>();
  const out: SkillNode[] = [];
  for (const g of [...groups].sort((a, b) => a.sort_order - b.sort_order))
    for (const i of g.items) {
      const key = skillKey(i.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: i.name, key, tier: i.tier, group: g.id, groupLabel: g.label });
    }
  return out;
}

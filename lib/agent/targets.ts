import seed from "@/content/seed.json";
import type { Content } from "@/lib/types";
import { skillKey, uniqueSkills } from "@/lib/skills";
import { position, scrollToY, yOf } from "@/lib/scroll";

// Agent targets: every element the agent can act on carries
// data-agent-id="<kind>:<key>". Components build ids with `agentId` and the
// enums below are built from seed.json with the same helpers, so the DOM and
// the action registry cannot drift apart.

const content = seed as Content;

export const SECTIONS = [
  "hero",
  "projects",
  "stack",
  "experience",
  "credentials",
  "contact",
] as const;
export type SectionId = (typeof SECTIONS)[number];

export const CTAS = ["cv", "cv-contact", "email", "github", "linkedin"] as const;
export type CtaId = (typeof CTAS)[number];

export const agentId = {
  section: (s: SectionId) => `section:${s}`,
  nav: (s: SectionId) => `nav:${s}`,
  project: (slug: string) => `project:${slug}`,
  projectDetail: (slug: string) => `project-detail:${slug}`,
  gallery: (slug: string) => `gallery:${slug}`,
  stack: (groupId: string) => `stack:${groupId}`,
  skill: (name: string) => `skill:${skillKey(name)}`,
  experience: (id: string) => `experience:${id}`,
  cta: (c: CtaId) => `cta:${c}`,
  commandInput: () => "command:input",
};

// ---- enums from seed.json -----------------------------------------------------
export const PROJECT_SLUGS = content.projects.map((p) => p.slug);
export const GALLERY_SLUGS = content.projects
  .filter((p) => p.gallery.length > 0)
  .map((p) => p.slug);
export const PROJECT_TAGS = [...new Set(content.projects.flatMap((p) => p.stack))];

/** every id `highlight` may point at */
export const HIGHLIGHT_TARGETS: string[] = [
  ...SECTIONS.map(agentId.section),
  ...content.projects.map((p) => agentId.project(p.slug)),
  ...content.skill_groups.map((g) => agentId.stack(g.id)),
  ...uniqueSkills(content.skill_groups).map((s) => agentId.skill(s.name)),
  ...content.experiences.map((e) => agentId.experience(e.id)),
  ...CTAS.map(agentId.cta),
];

// ---- DOM ----------------------------------------------------------------------

// The projects depth stage (components/projects/depth-stage.tsx) stacks its
// chapters as image slabs in one sticky stage, so a slab's box can be on
// screen while it is faded out in the distance. While the stage is active
// each slab carries data-depth-state ("front", "near" or "far"), and the
// stage registers how to bring a chapter to the front and open its overlays.

type DepthState = "front" | "near" | "far";

function depthState(el: HTMLElement): DepthState | undefined {
  return el.closest?.<HTMLElement>("[data-depth-state]")?.dataset.depthState as
    | DepthState
    | undefined;
}

export interface DepthStageApi {
  /** element inside a chapter -> scrollY that brings that chapter to the front */
  scrollY(el: HTMLElement): number | null;
  /** open a project's detail overlay */
  openDetail(slug: string): void;
  /** open a project's gallery overlay */
  openGallery(slug: string): void;
}

let depthApi: DepthStageApi | null = null;

export function setDepthStage(api: DepthStageApi | null) {
  depthApi = api;
}

/** the active depth stage, or null (plain cards: under 768px, reduced motion, no JS) */
export function depthStage() {
  return depthApi;
}

/** at least partly inside the viewport */
export function inViewport(el: HTMLElement) {
  if (depthState(el) === "far") return false;
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  );
}

function rendered(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Resolve an agent id to its element. When several elements share an id (the
 * hero and docked command bars), the one on screen wins, then any rendered one.
 */
export function resolveTarget(id: string): HTMLElement | null {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-agent-id="${CSS.escape(id)}"]`)
  );
  return all.find(inViewport) ?? all.find(rendered) ?? null;
}

/** first candidate id that resolves to a rendered element */
export function resolveFirst(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    const el = resolveTarget(id);
    if (el && rendered(el)) return el;
  }
  return null;
}

/** fully visible, and not hidden under the sticky top bar or the dock */
export function isComfortablyVisible(el: HTMLElement) {
  const depth = depthState(el);
  if (depth && depth !== "front") return false;
  const r = el.getBoundingClientRect();
  const top = 72;
  const bottom = window.innerHeight - 120;
  const tall = r.height > bottom - top;
  return tall ? r.top >= top && r.top < bottom - 80 : r.top >= top && r.bottom <= bottom;
}

export async function scrollToElement(
  el: HTMLElement,
  { instant, signal }: { instant: boolean; signal?: AbortSignal }
) {
  // the depth stage knows the scroll stop that brings a chapter to the front;
  // everything else is centred, or its top shown when it is tall. All through
  // the page's one scroll source (lib/scroll.ts), which stops where it is on
  // a cancel
  let y = depthApi?.scrollY(el) ?? null;
  if (y === null) {
    const r = el.getBoundingClientRect();
    const tall = r.height > window.innerHeight * 0.6;
    y = tall ? yOf(el) : r.top + position() - (window.innerHeight - r.height) / 2;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  await scrollToY(Math.max(0, Math.min(max, y)), { instant, signal });
}

const PULSE_MS = 2000;
const pulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** accent outline pulse on the element being acted on */
export function pulse(el: HTMLElement) {
  clearTimeout(pulseTimers.get(el));
  el.removeAttribute("data-agent-active");
  // force a reflow so a repeated pulse restarts its animation
  void el.offsetWidth;
  el.setAttribute("data-agent-active", "");
  pulseTimers.set(
    el,
    setTimeout(() => el.removeAttribute("data-agent-active"), PULSE_MS)
  );
}

/** dim project chapters whose stack does not include `tag`; null clears */
export function applyProjectFilter(tag: string | null) {
  document.querySelectorAll<HTMLElement>("[data-project-tags]").forEach((el) => {
    const tags = (el.dataset.projectTags ?? "").split("|");
    if (tag && !tags.includes(tag)) el.setAttribute("data-dimmed", "");
    else el.removeAttribute("data-dimmed");
  });
}

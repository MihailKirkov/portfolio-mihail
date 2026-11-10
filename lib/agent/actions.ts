import {
  GALLERY_SLUGS,
  HIGHLIGHT_TARGETS,
  PROJECT_SLUGS,
  PROJECT_TAGS,
  SECTIONS,
  agentId,
  applyProjectFilter,
  pulse,
  resolveTarget,
  scrollToElement,
  type SectionId,
} from "@/lib/agent/targets";
import { setAgentState } from "@/lib/agent/store";

// Action registry: a typed, closed set. Nothing outside this list can ever run.
// `validate` only accepts values from the enums built from seed.json (and no
// unknown keys); `targets` lists the agent ids the cursor flies to, first
// rendered one wins; `run` is the effect, fired after the cursor's click.

export interface ActionContext {
  /** reduced motion: scroll instantly, no choreography */
  instant: boolean;
  signal: AbortSignal;
}

export interface ActionDef<P> {
  name: string;
  validate(params: unknown): P | null;
  targets(params: P): string[];
  run(params: P, ctx: ActionContext): void | Promise<void>;
}

/** a requested action, as a canned script or (phase 2) the model emits it */
export interface ActionCall {
  name: string;
  params?: Record<string, unknown>;
}

export const MAX_ACTIONS_PER_REPLY = 4;

// ---- param validation ---------------------------------------------------------

/** params must be a plain object with exactly `keys` (or nothing, for none) */
function shape(params: unknown, keys: string[]): Record<string, unknown> | null {
  if (params === undefined || params === null) return keys.length ? null : {};
  if (typeof params !== "object" || Array.isArray(params)) return null;
  const obj = params as Record<string, unknown>;
  const got = Object.keys(obj);
  if (got.length !== keys.length || !keys.every((k) => got.includes(k))) return null;
  return obj;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function el(id: string) {
  return resolveTarget(id);
}

async function scrollTo(id: string, ctx: ActionContext) {
  const target = el(id);
  if (target) await scrollToElement(target, { instant: ctx.instant, signal: ctx.signal });
}

// ---- the actions --------------------------------------------------------------

const scroll_to: ActionDef<{ section: SectionId }> = {
  name: "scroll_to",
  validate(p) {
    const o = shape(p, ["section"]);
    const section = o && oneOf(o.section, SECTIONS);
    return section ? { section } : null;
  },
  targets: ({ section }) => [agentId.nav(section), agentId.section(section)],
  run: ({ section }, ctx) => scrollTo(agentId.section(section), ctx),
};

const open_project: ActionDef<{ slug: string }> = {
  name: "open_project",
  validate(p) {
    const o = shape(p, ["slug"]);
    const slug = o && oneOf(o.slug, PROJECT_SLUGS);
    return slug ? { slug } : null;
  },
  targets: ({ slug }) => [agentId.projectDetail(slug), agentId.project(slug)],
  async run({ slug }, ctx) {
    const summary = el(agentId.projectDetail(slug));
    const details = summary?.closest("details");
    if (details) details.open = true;
    await scrollTo(agentId.project(slug), ctx);
  },
};

const highlight: ActionDef<{ target: string }> = {
  name: "highlight",
  validate(p) {
    const o = shape(p, ["target"]);
    const target = o && oneOf(o.target, HIGHLIGHT_TARGETS);
    return target ? { target } : null;
  },
  targets: ({ target }) => [target],
  run({ target }) {
    const t = el(target);
    if (t) pulse(t);
  },
};

const filter_projects: ActionDef<{ tag: string }> = {
  name: "filter_projects",
  validate(p) {
    const o = shape(p, ["tag"]);
    const tag = o && oneOf(o.tag, PROJECT_TAGS);
    return tag ? { tag } : null;
  },
  targets: () => [agentId.section("projects")],
  async run({ tag }, ctx) {
    applyProjectFilter(tag);
    setAgentState({ filterTag: tag });
    await scrollTo(agentId.section("projects"), ctx);
  },
};

const show_gallery: ActionDef<{ slug: string }> = {
  name: "show_gallery",
  validate(p) {
    const o = shape(p, ["slug"]);
    const slug = o && oneOf(o.slug, GALLERY_SLUGS);
    return slug ? { slug } : null;
  },
  targets: ({ slug }) => [agentId.gallery(slug)],
  run({ slug }) {
    // the target is the gallery's own "view larger" button
    el(agentId.gallery(slug))?.click();
  },
};

const offer_cv: ActionDef<Record<string, never>> = {
  name: "offer_cv",
  validate: (p) => (shape(p, []) ? {} : null),
  targets: () => [agentId.cta("cv")],
  run() {
    // highlight and focus only - never trigger the download
    const cv = el(agentId.cta("cv"));
    if (!cv) return;
    pulse(cv);
    cv.focus({ preventScroll: true });
  },
};

const offer_contact: ActionDef<Record<string, never>> = {
  name: "offer_contact",
  validate: (p) => (shape(p, []) ? {} : null),
  targets: () => [agentId.cta("email")],
  async run(_p, ctx) {
    await scrollTo(agentId.section("contact"), ctx);
    const email = el(agentId.cta("email"));
    if (email) pulse(email);
  },
};

// Params differ per action; each def is only ever called with params its own
// validate() produced, so the erased type is safe here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAction = ActionDef<any>;

export const ACTIONS = {
  scroll_to,
  open_project,
  highlight,
  filter_projects,
  show_gallery,
  offer_cv,
  offer_contact,
} satisfies Record<string, AnyAction>;

export type ActionName = keyof typeof ACTIONS;

export interface ValidAction {
  call: ActionCall;
  def: AnyAction;
  params: unknown;
}

/** registry check: known name + params inside the seed enums, else null */
export function validateAction(call: ActionCall): ValidAction | null {
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, call.name)) return null;
  const def: AnyAction = ACTIONS[call.name as ActionName];
  const params = def.validate(call.params);
  return params ? { call, def, params } : null;
}

/** compact label for the tool log, e.g. open_project slug=lead-hq */
export function formatCall(call: ActionCall) {
  const args = Object.entries(call.params ?? {})
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  return args ? `${call.name} ${args}` : call.name;
}

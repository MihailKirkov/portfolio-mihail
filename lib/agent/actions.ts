import {
  agentId,
  applyProjectFilter,
  pulse,
  resolveTarget,
  scrollToElement,
  type SectionId,
} from "@/lib/agent/targets";
import {
  isActionName,
  validateParams,
  type ActionCall,
  type ActionName,
} from "@/lib/agent/schema";
import { setAgentState } from "@/lib/agent/store";

// Action registry: a typed, closed set. Nothing outside this list can ever run.
// Names, params and their seed.json enums live in lib/agent/schema.ts (shared
// with the chat route); this file attaches the browser side. `validate` only
// accepts values from those enums (and no unknown keys); `targets` lists the
// agent ids the cursor flies to, first rendered one wins; `run` is the effect,
// fired after the cursor's click.

export { MAX_ACTIONS_PER_REPLY } from "@/lib/agent/schema";
export type { ActionCall, ActionName } from "@/lib/agent/schema";

export interface ActionContext {
  /** reduced motion: scroll instantly, no choreography */
  instant: boolean;
  signal: AbortSignal;
}

export interface ActionDef<P> {
  name: ActionName;
  validate(params: unknown): P | null;
  targets(params: P): string[];
  /** ids the effect brings into view, when that is not the cursor's target */
  lands?(params: P): string[];
  run(params: P, ctx: ActionContext): void | Promise<void>;
}

/** an action's validate(): the schema check, typed as that action's params */
function validator<P>(name: ActionName) {
  return (params: unknown) => validateParams(name, params) as P | null;
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
  validate: validator("scroll_to"),
  targets: ({ section }) => [agentId.nav(section), agentId.section(section)],
  lands: ({ section }) => [agentId.section(section)],
  run: ({ section }, ctx) => scrollTo(agentId.section(section), ctx),
};

const open_project: ActionDef<{ slug: string }> = {
  name: "open_project",
  validate: validator("open_project"),
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
  validate: validator("highlight"),
  targets: ({ target }) => [target],
  run({ target }) {
    const t = el(target);
    if (t) pulse(t);
  },
};

const filter_projects: ActionDef<{ tag: string }> = {
  name: "filter_projects",
  validate: validator("filter_projects"),
  targets: () => [agentId.section("projects")],
  async run({ tag }, ctx) {
    applyProjectFilter(tag);
    setAgentState({ filterTag: tag });
    await scrollTo(agentId.section("projects"), ctx);
  },
};

const show_gallery: ActionDef<{ slug: string }> = {
  name: "show_gallery",
  validate: validator("show_gallery"),
  targets: ({ slug }) => [agentId.gallery(slug)],
  run({ slug }) {
    // the target is the gallery's own "view larger" button
    el(agentId.gallery(slug))?.click();
  },
};

const offer_cv: ActionDef<Record<string, never>> = {
  name: "offer_cv",
  validate: validator("offer_cv"),
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
  validate: validator("offer_contact"),
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

// keyed by ActionName, so a spec without an effect (or the reverse) fails to compile
export const ACTIONS = {
  scroll_to,
  open_project,
  highlight,
  filter_projects,
  show_gallery,
  offer_cv,
  offer_contact,
} satisfies Record<ActionName, AnyAction>;

export interface ValidAction {
  call: ActionCall;
  def: AnyAction;
  params: unknown;
}

/** registry check: known name + params inside the seed enums, else null */
export function validateAction(call: ActionCall): ValidAction | null {
  if (!isActionName(call.name)) return null;
  const def: AnyAction = ACTIONS[call.name];
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

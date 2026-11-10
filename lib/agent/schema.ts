import {
  GALLERY_SLUGS,
  HIGHLIGHT_TARGETS,
  PROJECT_SLUGS,
  PROJECT_TAGS,
  SECTIONS,
} from "@/lib/agent/targets";

// The declarative half of the action registry: every action's name, what it
// does, and the closed enum each param must come from (built from seed.json).
// It has no DOM or React in it, so the chat route can import it to generate
// the model's tool schemas and to validate tool calls server-side, while
// lib/agent/actions.ts attaches the browser effects to the same specs.

export interface ActionSpec {
  description: string;
  /** param name -> allowed values; every listed param is required */
  params: Record<string, readonly string[]>;
}

export const ACTION_SPECS = {
  scroll_to: {
    description: "Scroll the page to one of its sections.",
    params: { section: SECTIONS },
  },
  open_project: {
    description:
      "Scroll to one project and expand its detail. Use it for the single project that best matches the request; point at any other relevant projects with highlight.",
    params: { slug: PROJECT_SLUGS },
  },
  highlight: {
    description:
      "Briefly outline one element on the page: a section, a project, a skill group, an experience entry, or a contact/CV button. Also the way to point at further matching projects after open_project.",
    params: { target: HIGHLIGHT_TARGETS },
  },
  filter_projects: {
    description:
      "Dim every project whose stack does not list this exact tag. Use it only when the visitor names one specific technology from the list. Tags are matched literally, so never use it for a broad theme (AI, frontend, backend, real-time...): projects under one theme carry different tags, and filtering on one of them would hide the rest. For a theme, use open_project on the best match and highlight on the others.",
    params: { tag: PROJECT_TAGS },
  },
  show_gallery: {
    description: "Open a project's screenshot gallery.",
    params: { slug: GALLERY_SLUGS },
  },
  offer_cv: {
    description: "Point the visitor at the CV button. Never downloads anything.",
    params: {},
  },
  offer_contact: {
    description:
      "Scroll to the contact section and point at the email link. The section holds links only (CV, email, GitHub, LinkedIn); there is no contact form.",
    params: {},
  },
} satisfies Record<string, ActionSpec>;

export type ActionName = keyof typeof ACTION_SPECS;

/** a requested action, as a canned script or the model emits it */
export interface ActionCall {
  name: string;
  params?: Record<string, unknown>;
}

export const MAX_ACTIONS_PER_REPLY = 4;

/** /api/chat responds with NDJSON: one of these per line, `done` last */
export type ChatEvent =
  | { t: "text"; d: string }
  | { t: "action"; name: string; params: Record<string, string> }
  | { t: "done" };

export function isActionName(name: unknown): name is ActionName {
  return (
    typeof name === "string" &&
    Object.prototype.hasOwnProperty.call(ACTION_SPECS, name)
  );
}

/**
 * Params must be a plain object holding exactly the spec's keys, each a string
 * from that key's enum (or nothing at all for a param-less action). Returns the
 * cleaned params, or null.
 */
export function validateParams(
  name: ActionName,
  params: unknown
): Record<string, string> | null {
  const spec: ActionSpec = ACTION_SPECS[name];
  const keys = Object.keys(spec.params);
  if (params === undefined || params === null) return keys.length ? null : {};
  if (typeof params !== "object" || Array.isArray(params)) return null;
  const obj = params as Record<string, unknown>;
  const got = Object.keys(obj);
  if (got.length !== keys.length) return null;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    if (typeof value !== "string" || !spec.params[key].includes(value)) return null;
    out[key] = value;
  }
  return out;
}

/** registry check: known name + params inside the seed enums, else null */
export function validateCall(
  name: unknown,
  params: unknown
): { name: ActionName; params: Record<string, string> } | null {
  if (!isActionName(name)) return null;
  const clean = validateParams(name, params);
  return clean ? { name, params: clean } : null;
}

/** JSON schema per action, for the model's tool definitions */
export function toolSchemas() {
  return (Object.entries(ACTION_SPECS) as [ActionName, ActionSpec][]).map(
    ([name, spec]) => ({
      name,
      description: spec.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(spec.params).map(([key, allowed]) => [
            key,
            { type: "string", enum: [...allowed] },
          ])
        ),
        required: Object.keys(spec.params),
        additionalProperties: false,
      },
    })
  );
}

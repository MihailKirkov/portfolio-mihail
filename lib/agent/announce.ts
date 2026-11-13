"use client";

import { agentId, resolveTarget } from "@/lib/agent/targets";
import type { ActionCall } from "@/lib/agent/schema";

// Screen-reader feedback for the agent's actions: each finished action says
// what changed on the page, through one polite live region
// (#agent-announcer, rendered by the command bar). Messages queue up so a
// reply with several actions is read in order, not overwritten.

const REGION_ID = "agent-announcer";
const queue: string[] = [];
let timer = 0;

function projectName(slug: string) {
  const el = resolveTarget(agentId.project(slug));
  return el?.querySelector("h2, h3")?.textContent?.trim() || slug;
}

export function describeAction(call: ActionCall): string | null {
  const p = (call.params ?? {}) as Record<string, string>;
  switch (call.name) {
    case "scroll_to":
      return `Moved to the ${p.section} section.`;
    case "open_project":
      return `Opened ${projectName(p.slug)}.`;
    case "show_gallery":
      return `Opened the ${projectName(p.slug)} screenshots.`;
    case "filter_projects":
      return `Projects filtered to ${p.tag}.`;
    case "highlight": {
      // a row's own name: its label, title or heading, not all of its text
      const t = resolveTarget(p.target);
      const named = t?.querySelector("dt, h2, h3, h4, .project-title");
      const name = (t?.getAttribute("aria-label") || named?.textContent || t?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      return name && name.length <= 60 ? `Highlighted ${name}.` : "Highlighted an item on the page.";
    }
    case "offer_cv":
      return "Focused the CV download button.";
    case "offer_contact":
      return "Moved to the contact section.";
    default:
      return null;
  }
}

function flush() {
  const region = document.getElementById(REGION_ID);
  const next = queue.shift();
  if (!region || next === undefined) {
    timer = 0;
    return;
  }
  // clear first so the same sentence twice is still read twice; the gap
  // after it lets a screen reader finish before the next one replaces it
  region.textContent = "";
  timer = window.setTimeout(() => {
    region.textContent = next;
    timer = window.setTimeout(flush, 900);
  }, 50);
}

export function announce(text: string) {
  if (typeof document === "undefined") return;
  queue.push(text);
  if (!timer) timer = window.setTimeout(flush, 0);
}

export const ANNOUNCER_ID = REGION_ID;

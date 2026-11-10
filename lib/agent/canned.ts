import type { ActionCall } from "@/lib/agent/actions";

// Hardcoded answers + action scripts for the three suggestion chips. They run
// the full agent demo (typed answer, then cursor + actions) and NEVER hit the
// network, so no API key, rate limit, or outage can break them. Only questions
// the visitor free-types go to /api/chat. Keys must match terminal.suggestions
// in seed.json.

export interface CannedReply {
  text: string;
  actions: ActionCall[];
}

export const CANNED: Record<string, CannedReply> = {
  "What's your stack?": {
    text: "Frontend is React / Next.js / TypeScript; backend is Node.js, PHP and Python; plus real AI integration - Claude API, RAG, tool use and agents. Full-stack, shipped end to end.",
    actions: [
      { name: "scroll_to", params: { section: "stack" } },
      { name: "highlight", params: { target: "stack:frontend" } },
      { name: "highlight", params: { target: "stack:backend" } },
      { name: "highlight", params: { target: "stack:ai" } },
    ],
  },
  "Why should we hire you?": {
    text: "I ship AI features end to end, not just demos. A fast, low-risk hire who already builds in production.",
    actions: [
      { name: "scroll_to", params: { section: "experience" } },
      { name: "highlight", params: { target: "experience:gutes-fullstack" } },
      { name: "offer_cv" },
    ],
  },
  "Tell me about a project": {
    text: "Lead-HQ - a lead-management platform I built solo: Next.js 15 + Supabase, Apify for Google-Maps scraping, and an AI grader that scores every lead automatically. End-to-end, from scrape to scored pipeline.",
    actions: [
      { name: "open_project", params: { slug: "lead-hq" } },
      { name: "show_gallery", params: { slug: "lead-hq" } },
    ],
  },
};

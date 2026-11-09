# portfolio-mihail

Next.js 15 (App Router), React 19, TypeScript, Tailwind 4, Framer Motion,
Claude API chat route. Deployed on Vercel.

The v3 rebuild is specified in `docs/V3-PLAN.md`. Read it before any v3 work
and follow its non-negotiables. Work one phase at a time; do not start the
next phase unasked.

- Content lives only in `content/seed.json`. Never hardcode profile facts.
- Never invent facts about Mihail in copy or in the chat system prompt.
- Use plain hyphens in copy, not em dashes.
- Before finishing a phase: `npm run lint` and `npm run build` must pass.
- Do not commit `.env.local`. Do not push or deploy unless asked.

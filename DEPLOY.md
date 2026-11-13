# Launch checklist (v3)

The site is static (`/` is prerendered from `content/seed.json`); the only
runtime dependency is the Anthropic key behind `/api/chat`.

## 1. Environment variables (Vercel)

Project -> Settings -> Environment Variables. Set for Production (and Preview
if previews should have a working chat).

| Variable | Value | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Server only. Never prefix with `NEXT_PUBLIC_`. Without it, chips still work and typed questions get the failure message. |
| `NEXT_PUBLIC_SITE_URL` | `https://portfolio-mihail.vercel.app` (or your domain), no trailing slash | Baked in at build: canonical, Open Graph URL, robots, sitemap. Falls back to `http://localhost:3000` if unset. Redeploy after changing it. |

## 2. Spend limit (Anthropic console)

- In the Anthropic console, open the organisation's limits page
  (Settings -> Limits) and set a **monthly spend limit** for the workspace the
  key belongs to. Pick a number you are fine losing in a bad month.
- Use a key made only for this site, so it can be revoked on its own.
- The route already caps each request (500 input chars, 10 messages of
  history, 450 output tokens, `claude-haiku-4-5`) and rate-limits 10 requests
  per minute per IP. That limiter lives in memory per serverless instance,
  so it is not a hard ceiling: the spend limit is.

## 3. Ship v3 to production

Pick one:

- **Merge `v3` into `main`** (production keeps tracking `main`): open a PR
  `v3 -> main`, check its preview deployment, merge. Vercel deploys `main`.
- **Or switch the production branch** to `v3`: Vercel -> Project -> Settings
  -> Environments -> Production -> Branch Tracking (older UI: Settings -> Git
  -> Production Branch), set `v3`, then redeploy the latest `v3` commit.

Merging is the cleaner long-term option; switching is faster and easy to
revert.

## 4. Check the live URL

- [ ] **Intro**: in a fresh private window, the boot intro plays once and
      ends in the hero; a reload in the same tab skips it.
- [ ] **Chips**: all three answer instantly and the cursor runs their actions.
- [ ] **Typed question**: a free question streams an answer and moves the
      page. A 503 means `ANTHROPIC_API_KEY` is missing; a 429 is the rate
      limit.
- [ ] **Projects**: depth stage on desktop (rail, details, gallery viewer);
      plain cards on a phone.
- [ ] **Phone**: menu reaches every section, the docked bar stays above the
      keyboard, the core sits in its slot.
- [ ] **CV** downloads; GitHub, LinkedIn and email links are correct.
- [ ] **Reduced motion** (OS setting): no intro, no flights; actions still
      happen.
- [ ] **Share image**: paste the URL into opengraph.xyz or LinkedIn Post
      Inspector; the new card shows with the right title and description.
- [ ] **404**: `/nope` shows the v3 "Nothing here." page.
- [ ] **robots.txt / sitemap.xml** point at the live URL, not localhost.
- [ ] **Lighthouse** on the live URL (mobile): performance 90+, CLS under
      0.1. Expect simulated LCP to vary; the headline paints in the first
      frame.
- [ ] **Anthropic console usage** after the first day: spend looks sane.

## Updating content

Edit `content/seed.json` and push. The page, the agent's action enums and its
system prompt all rebuild from it.

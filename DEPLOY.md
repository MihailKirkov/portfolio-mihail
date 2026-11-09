# Deploy guide

Production deploy is a manual import into [Vercel](https://vercel.com). The site
is fully static (`/` is prerendered) and reads all content from
`content/seed.json` — no database or external services are required to build or
run. The only runtime dependency is the Anthropic API key powering the chat
terminal.

## 1. Import the repo

1. In the Vercel dashboard: **Add New… → Project → Import Git Repository**.
2. Select this repository. Vercel auto-detects Next.js — no build settings to
   change (build `next build`, output `.next`, install `npm install`).
3. Don't deploy yet — set the environment variables first (next step).

## 2. Environment variables

Set these under **Project → Settings → Environment Variables** (apply to
Production, and Preview if you want previews to work too):

| Variable | Scope | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **Server only** — do _not_ prefix with `NEXT_PUBLIC_` | Your Anthropic API key (`sk-ant-…`). Powers `/api/chat`. |
| `NEXT_PUBLIC_SITE_URL` | Public | The site's canonical URL, e.g. `https://your-project.vercel.app` (no trailing slash). |

Notes:
- `ANTHROPIC_API_KEY` must stay server-only. It is read exclusively in the
  `/api/chat` route handler (Node runtime) and is never exposed to the client.
- `NEXT_PUBLIC_SITE_URL` feeds `metadataBase`, the canonical tag, Open Graph
  URL, `robots.txt`, and `sitemap.xml`. If unset it falls back to
  `http://localhost:3000`, so set it before the first production deploy.
- After the first deploy you'll know the real `*.vercel.app` URL (or a custom
  domain). Set `NEXT_PUBLIC_SITE_URL` to it and **redeploy** so metadata,
  canonical, and sitemap point at the live origin.

## 3. Deploy

Click **Deploy**. Subsequent pushes to the production branch auto-deploy.

---

## Post-deploy test checklist

- [ ] **Live chat** — open the terminal, type a free-form question (e.g. "what's
      your AI experience?") and confirm a streamed answer comes back. The three
      suggestion chips return instantly (canned, no network); only typed
      questions hit `/api/chat`. If chat returns a 503, `ANTHROPIC_API_KEY` is
      missing/misscoped.
- [ ] **CV download** — click **CV** (top-right) and the mobile **download CV**
      button; confirm `Mihail-Kirkov-CV.pdf` downloads and opens.
- [ ] **Socials** — GitHub and LinkedIn open the real profiles in a new tab;
      the email icon and "book a call" open a `mailto:` to
      `mihailkirkov04@gmail.com`.
- [ ] **OG preview** — paste the live URL into
      [opengraph.xyz](https://www.opengraph.xyz/) and/or the
      [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/);
      confirm the cold-blue HUD card with "MIHAIL KIRKOV" renders and the title
      and description are correct. (LinkedIn caches — re-inspect to refresh.)
- [ ] **Favicon** — the MK monogram shows in the browser tab.
- [ ] **Mobile** — open on a phone (or DevTools device mode): the mobile layout
      renders, nodes open modals, CV/book-a-call work, terminal works.
- [ ] **Mode switcher** — Visor / Flight deck / Reactor morph and persist across
      reloads (localStorage); arrow keys cycle the tabs.
- [ ] **Lighthouse** (Chrome DevTools → Lighthouse, **desktop**) — confirm
      **Accessibility ≥ 90** and **Performance ≥ 90**. Run against the
      production URL, not localhost.
- [ ] **404 / error** — visit a nonexistent path (e.g. `/nope`) and confirm the
      "SIGNAL LOST // 404" HUD page with a link home.
- [ ] **robots / sitemap** — `…/robots.txt` and `…/sitemap.xml` resolve and
      reference the live `NEXT_PUBLIC_SITE_URL`.

## Updating content

Edit `content/seed.json` and push. Everything (page content + the chatbot's
grounding) rebuilds from that single file.

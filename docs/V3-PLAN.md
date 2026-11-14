# Portfolio v3 - build plan

Concept: **Operator**. The site is operated by an AI agent. A visitor types a
request, the agent answers AND drives the interface with a visible cursor
(scrolls, opens a project, highlights the stack). A short "swarm" boot intro
assembles the hero on first load. Projects are scroll-driven depth chapters.

Audience: future recruiters and potential freelance clients.
Reference sketches: the "Portfolio v3 directions" canvas (A Operator, B Swarm, C Depth).

## Non-negotiables

- The page is complete, static, server-rendered HTML underneath. Every
  animation is a layer on top. With JS off, reduced motion on, or the motion
  code failing, all content is readable and all links work.
- `content/seed.json` stays the single content source. No runtime DB.
- The chat keeps its guards: server-side key, input/history/output caps,
  per-IP rate limit, graceful failure text.
- The three suggestion chips keep working with zero network (canned answer +
  canned action script).
- `prefers-reduced-motion`: no cursor flight, no intro, no scroll 3D. Actions
  still happen (instant scroll/open), just without choreography.
- Mobile is the same site, not a "lite view". Delete the lite-view note.
- One phase per branch commit. `npm run build` and `npm run lint` pass at the
  end of every phase.

## Visual identity (new)

- Ground `#0a0b0d`, panel `#111317`, hairline `#23272e`, border `#3a3f47`,
  text `#e8eaed`, muted `#a3a9b3`.
- ONE accent, defined once as `--accent` (default `#c8f542`, OPEN DECISION,
  must be a one-line change). Accent is reserved for agent activity: the
  cursor, the active tool call, the element being acted on, the primary CTA.
- The one exception is the boot intro: its four role cursors have their own
  colours (`--intro-layout/-copy/-media/-style`, each >= 8:1 on the ground) and
  the hero starts in a grey wireframe (`--intro-grey`). These tokens are used
  nowhere else; the intro ends by merging into the single accent agent cursor.
- Type: Space Grotesk (UI + display), JetBrains Mono (labels, tool calls).
  Load with `next/font`.
- Square corners, 1px lines, no glow stacks, no gradient washes, no particle
  field. The old blue HUD chrome, mode tabs and three layouts are removed.
  The one exception is the lime stream (below), a deliberately faint
  background.

## Page structure (one scrolling page)

1. **Hero** (100svh): top bar, headline, core, command bar + suggestion chips,
   tool-call log, streamed answer line.
2. **Projects**: 5 depth chapters (job-cc, lead-hq, ignis, ignight, izlei).
3. **Stack** and **Experience** (the journey: About, roles, milestones and
   certifications on one path): renderers in `lib/sections.tsx`. There is no
   separate Credentials section (folded into the journey in the final pass).
4. **Contact**: CV, email, GitHub, LinkedIn.

The command bar docks to the bottom of the viewport after the hero and stays
available on every section.

## Architecture

### Agent targets
Any element the agent can act on carries `data-agent-id="..."`
(`section:projects`, `project:job-cc`, `stack:ai`, `cta:cv`, ...). A small
registry (`lib/agent/targets.ts`) resolves an id to an element.

### Action registry - `lib/agent/actions.ts`
Typed, closed set. Nothing outside this list can ever run.

| action | params | effect |
|---|---|---|
| `scroll_to` | `section`: hero, projects, stack, experience, contact | smooth scroll |
| `open_project` | `slug` (one of the seed slugs) | scroll to chapter, expand detail |
| `highlight` | `target` (a known agent id) | accent outline pulse for ~2s |
| `filter_projects` | `tag` (from seed stacks) | dim non-matching chapters |
| `show_gallery` | `slug` | open that project's gallery |
| `offer_cv` | none | highlight + focus the CV button (never auto-download) |
| `offer_contact` | none | scroll to contact, highlight email |

Each action = `{ name, validate(params), run(ctx) }`. `validate` rejects
anything not in the enums built from `seed.json`.

### Cursor engine - `components/agent/cursor.tsx` + `lib/agent/choreo.ts`
One engine, two users (agent actions and the boot intro).
- A queue of steps: `moveTo(targetId)`, `click()`, `type(el, text)`,
  `drag(from, to)`, `wait(ms)`.
- Fixed-position SVG arrow + label, animated with Framer Motion along a
  curved path, 350-600ms per move, eased. Supports N cursors with a role
  label and color (agent uses one; the intro uses four).
- Running an action = cursor moves to the target, clicks, THEN the action
  effect fires. A dotted trail is optional polish, not phase 1.
- The agent never fights the visitor. A click, tap or key press cancels the
  queue immediately.
- Scroll and touch-scroll pause the queue instead: the step in flight stops,
  and about 500ms after the last scroll event the queue resumes, re-running
  that step so the cursor path is recomputed from the current viewport.
  It only auto-resumes when the current target is still on screen. If the
  visitor's scroll moved it out of view, the agent does not scroll back: the
  queue stops and the "Show me" button is offered instead.
  Scrolling for more than about 4 seconds is treated as a cancel.
- Tested without a browser against a fake window and driver:
  `npm run test:choreo` (pause, resume, cancel, replay).

### API - `app/api/chat/route.ts`
- Add Claude tool use: one tool per action above, with JSON schemas whose
  enums are generated from `seed.json`.
- Single model call per message. Tools are UI directives executed on the
  client; there is no tool-result round trip.
- Response becomes NDJSON, one event per line:
  `{"t":"text","d":"..."}`, `{"t":"action","name":"open_project","params":{...}}`, `{"t":"done"}`.
- Server validates every tool call against the registry before emitting it.
  Max 4 actions per reply. Keep model, caps and rate limiter as they are.
- Act first: a model turn ends at its tool calls, so answer text cannot follow
  them in one call. Replies that drive the page carry their answer in one
  extra tool, `say`, called last; the server streams it out as `text` events.
  `say` is not an action and is never emitted as one.
- Output cap is 450 tokens (text + tool calls). A tool call cut off by the cap
  is dropped, never emitted partially; `done` is always sent.
- System prompt (`lib/chat-context.ts`): keep the fact rules; add "when the
  visitor asks to see something, call the matching tool and keep the text to
  1-2 sentences"; broaden audience to recruiters and freelance clients.

### Client - replaces `components/hud/terminal.tsx`
- `components/agent/command-bar.tsx`: input, chips, streamed answer, tool log.
- Parses NDJSON, appends text, pushes actions into the cursor queue in order.
- Canned chips: `CANNED` gains an `actions` array per question so they run a
  full scripted demo offline. Like streamed replies they act first and talk
  during: the actions start immediately while the answer types.
- "Show me": when a reply's actions were cancelled or are still pending once
  playback has stopped (including a stop because the target was scrolled out
  of view), the command bar shows a "Show me" button that replays
  the remaining actions. It disappears after use or on the next question.

### Core - `components/core/`
- React Three Fiber, GLSL shader material on an icosphere + 2-3 orbit rings.
  `three`/`@react-three/fiber`/`drei` are already in package.json and unused.
- WebGLRenderer only. No WebGPU/TSL in this version.
- `next/dynamic` with `ssr:false`; the existing CSS core
  (`reactor-core.tsx`, restyled) is the SSR placeholder and the fallback for
  reduced motion, no WebGL, or `navigator.hardwareConcurrency <= 4`.
- One `uState` uniform driven by agent state: idle, thinking (request in
  flight), executing (cursor queue non-empty). Pointer tilt stays.
- Pause rendering when the hero is off-screen or the tab is hidden.

### Boot intro - `components/intro/`
- Hero only, up to about 6s, four role cursors, each in its own colour. All
  hero text starts in a neutral grey wireframe state.
  - layout: drags the command panel's frame out from its corner, then sets its
    controls: the suggestion chips and the input field.
  - copy: types the headline line by line, then the panel's greeting, gliding
    along each line on one linear move (never a move per character), with a
    linear carriage return between lines. Readable pace (about 32ms/char on
    the headline, 21ms/char on the greeting).
  - media: drops the core in (no cursor when the core is hidden, on phones).
  - style: gives the CV button its accent, then sweeps the hero from grey to
    its real colours: the headline stack (the headline sits grey for at least
    1s after copy finishes it), then the panel once copy has left it. Style
    never colours a piece copy is still on.
  - Endings are independent: each cursor, as soon as its own work is done,
    flies to the command bar and docks into the one accent agent cursor
    there. The agent appears with the first dock and stays; copy has the most
    to do and arrives last.
- Motion rules: no flight shorter than 450ms; longer flights are slower so no
  cursor moves more than 60px in a 60Hz frame; paths bow into the page, never
  out past its edge. Every target is measured once, after fonts load and
  before anything moves; typed elements are clipped, never resized, so nothing
  reflows and no cursor re-aims mid-flight.
- Implemented as a reveal over the real, already-rendered hero (clip/opacity
  on the real elements, colours via a CSS hold state released per element),
  not a second copy of the DOM. Runs on the cursor engine (`parallel` tracks,
  `dock` step).
- "Skip intro" button from frame 1. Runs once per session (sessionStorage).
  Skipped entirely under reduced motion, with JS off and on a #section deep
  link. Skip, click, tap or Escape ends it at once: everything, colours
  included, jumps straight to the final look.
- Scrolling does not end it, it fast-forwards it. The first wheel, touch
  scroll or other key (arrows, space, page keys) is absorbed, and the rest of
  the choreography plays to the end at high speed - cursors still fly and
  dock - within at most 1.2s, however much was left. Every scroll during the
  fast-forward is absorbed too and dropped, never replayed, so the page does
  not lurch when the hold ends; then scrolling is released. The hold can never
  exceed 1.2s: if anything stalls, the head script releases scroll and jumps
  to the final state. How: one rate-adjustable clock (`lib/agent/clock.ts`)
  times every wait, flight and reveal in the intro; fast-forward raises its
  rate so what the plan has left fits the hold. The head script owns visitor
  input for the intro (the engine runs the intro batch with `ownInput`).
- Browser checks: `npm run test:intro` (needs `npm run build`) plays it at
  1440x900 and 390x844 in Chrome and checks the budget, flight times, per-frame
  steps, one glide per typed line, dock order, reflow and the copy/style
  handoffs; then scroll at 0.2s and at 3s, more scrolling and keys during the
  fast-forward, an arrow key, a touch scroll on a phone, the 1.2s cap with a
  stalled fast-forward, and Escape.

### Project depth chapters - `components/projects/`
- A sticky stage driven by Framer Motion `useScroll`; each project slab
  moves along Z with scroll progress; the next slab is visible small in the
  distance. Chapter rail on the left.
- Where the core's WebGL gate passes, an R3F scene (`depth-gl.tsx`, lazy,
  near the section) draws the slabs as textured planes the camera travels
  through, with scroll-velocity motion and a per-project background mood
  (after the Codrops depth gallery, MIT). The CSS 3D slabs are its
  placeholder and the fallback; the DOM rail, panel and overlays stay on top.
- Reuse gallery logic from `components/hud/project-deck.tsx`.
- Under 768px or reduced motion: plain vertical cards, same content.

## Keep / change / delete

- Keep: `content/seed.json`, `lib/content.ts`, `lib/types.ts`,
  `lib/sections.tsx` (renderers), chat guards, canned answers, OG/icon routes
  (restyle), gallery logic.
- Change: `route.ts`, `chat-context.ts`, `globals.css` (rewrite against new
  tokens; it is 2059 lines of HUD css), `app/page.tsx`, `app/layout.tsx`.
- Delete after phase 0: `mode-tabs`, `chrome`, `stage`, `frame`, `background`,
  `lib/layout.ts`, `mobile-view`, dials/gauges not reused, `cockpit-mockups.html`.

## Content fixes (owner must supply wording)

- `profile.pitch`, `profile.availability`, layout metadata description and
  README still say "available August 2026". Replace with
  [CURRENT STATUS LINE - owner to write].
- Hero headline and sub copy in the sketches are placeholders.

## Phases

0. **Foundation** - branch `v3`; tokens + fonts; scrolling page skeleton with
   all sections static and styled; remove HUD modes; content fixes. Site is
   shippable and plain at the end of this phase.
1. **Cursor engine + actions** - targets, action registry, cursor engine,
   command bar UI, canned chips running scripted actions. No API change.
2. **Real agent** - tool use + NDJSON in the route, client parsing, validation,
   updated system prompt.
3. **Boot intro** - four-cursor hero assembly on the same engine.
4. **Shader core** - R3F core with agent-state uniform and fallbacks.
   Pointer effects: a soft spotlight that follows the pointer across the
   background, magnetic pull on the primary buttons, and the core reacting to
   pointer distance. All off under reduced motion and on touch devices.
5. **Depth chapters** - scroll-driven projects section.
6. **Hardening** - mobile pass at 390px, keyboard + screen-reader pass,
   Lighthouse (target: perf >= 90 mobile, LCP < 2.5s, three.js in its own lazy
   chunk), new OG image, README + screenshots. Set a monthly spend limit in
   the Anthropic console before going live.

Phases 0-2 are the product. 3-5 are independent and can ship in any order.

## Round 2 - cinematic sections below the projects

Four parts, built in order, one commit per part. Rules for all of them:

- Copy stays the owner's. New text goes into `seed.json` as fields marked
  `[PLACEHOLDER]`; no final copy is written.
- 3D scenes follow the projects stage: lazy-loaded within one screen of the
  section, shared three.js/R3F chunks and `r3f-shared.tsx`, the core's gate,
  paused off screen and on a hidden tab, CSS/plain fallback for phones,
  reduced motion, low-end and no WebGL. At most two live WebGL contexts
  besides the core: scenes far off screen unmount.
- Scroll motion reads the Lenis scroll value directly, no extra springs.
  Transform/opacity on DOM, smooth easing in GL. One accent (lime).
- `scroll_to` reaches every section; `highlight` works on the new elements.

### Part 1 - Narrator (replaces the idle auto-demo)
- The idle auto-demo is removed.
- `seed.narration`: one `[PLACEHOLDER]` line per section (with an optional
  agent id to pulse) plus one idle hint line. No model calls.
- First entry into a section per visit: the core shows that line in a small
  bubble beside it for about 4s and pulses the configured element once.
- Idle about 12s with no input: the core wakes (turns toward the pointer,
  rings speed up) and shows the idle hint once. Nothing moves or scrolls.
- Typing, a chip click or any agent run stops narration for the visit.
- Bubbles are `aria-live="polite"`; under reduced motion they are plain text
  without animation.

### Part 2 - Stack constellation
- The tag grid becomes skills orbiting the core in three tilted elliptical
  rings by tier: daily inner and bright, shipped-with middle, familiar outer
  and dim. Rings drift slowly and rotate a little with scroll.
- Hover/focus on a skill (and the agent's `highlight`) highlights it and
  draws lines to small cards for every project whose stack includes it.
- Group labels sit quietly at ring sectors.
- Fallback: the tiered list as a real list. Every skill keyboard-reachable
  in both versions.

### Part 3 - Finale (contact)
- On scrolling in: the docked bar hides, the core grows large at the centre,
  the five project images fly in from the edges and orbit it, a few skills
  drift in.
- Below: the contact headline (seed), the email as a large click-to-copy
  link, CV primary, GitHub and LinkedIn secondary.
- Once settled the agent cursor parks on the email with "click to copy".
- Scrolling back up reverses it and the bar returns. Fallback: static large
  core image with the same content.

### Part 4 - Journey (about + experience)
- About merges into Experience. The camera flies through one gate per
  career step from the timeline data, newest last; the first gate is About
  (photo + about text).
- The core rides a lime floor path ahead of the camera; a big faint year sits
  behind the current gate. A flat info panel on the left crossfades to the
  current step (date, company, role, bullets, tags), never transformed. A
  year rail on the right shows position and jumps on click.
- Passing a gate is continuous: the camera moves along the path, the gate
  scales past the viewport edges, the next one is already visible. Same
  motion bar as the projects stage.
- Fallback: the current vertical timeline.

## Final pass (structure as shipped)

- Sections: hero, projects, stack, experience (journey), contact. Nav,
  `SECTIONS`/`scroll_to`, agent targets and narration keys match; nothing
  points at "credentials".
- Journey: certifications are small dashed markers on the path at their
  dates (label only while current). The About gate carries one heading and
  the competitive record, languages and education as short labelled facts.
  The info panel is capped above the dock; its body scrolls inside a fade
  mask. Roles show two bullets and a "more" toggle for the rest.
- Fallback (phones, reduced motion, no JS): the about block with the same
  facts, then the vertical timeline with certifications as marks.
- Hero: the command panel is sized to its content; the hero narration line
  is printed in the panel under the greeting (until the first question)
  instead of a bubble over it. The narrator still plays the hero pulse.

## Lime stream (site-wide background)

- Target `docs/design/lime-stream.html` at intensity 0.15. One fixed canvas
  2D layer (`components/site/lime-stream.tsx`, lazy chunk) behind all
  content: blurred low-res haze, silk fibres, star dust; creamy core, lime
  body, blue edges.
- Canvas 2D, not WebGL: a shader was cheaper per frame (about 3-4ms vs 7ms)
  but would be a fourth live WebGL context. 30fps at rest and on phones,
  full rate only while scrolling or morphing; fewer fibres on phones.
- Shape keyframes per section (hero, projects, stack, experience, contact),
  blended from the Lenis scroll value; Lenis velocity drives turbulence. In
  the contact finale it is mirrored and converges into the core.
- Behind the projects stage (its GL background is 80% opaque), the
  constellation and the journey (stage background transparent). Dimmer in
  the journey and behind the stack's plain list.
- Frosted glass (`--glass` + backdrop blur) on the hero command panel, the
  dock, the projects info panel and the journey panel.
- Reduced motion: one static frame per section. Paused on a hidden tab and
  while the boot intro holds the page.

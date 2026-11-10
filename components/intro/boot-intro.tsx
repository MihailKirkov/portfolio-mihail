"use client";

import { useEffect } from "react";
import {
  choreo,
  DEFAULT_CURSOR,
  prefersReducedMotion,
  type Aim,
  type Step,
} from "@/lib/agent/choreo";
import { inViewport } from "@/lib/agent/targets";
import {
  drawFrame,
  dropIn,
  fadeIn,
  inputLines,
  introPart,
  introTone,
  lineBoxes,
  stopReveals,
  styleIn,
  typeLine,
  type LineBox,
} from "@/lib/intro/reveal";

// The boot intro (~4s): four role cursors, each in its own colour, assemble the
// real, already-rendered hero on the shared cursor engine. Everything starts as
// a grey wireframe.
//   layout - drags the command panel's frame out from its corner
//   copy   - types the headline line by line, then the panel's greeting, chip
//            labels and input placeholder, the cursor riding the typed text
//   media  - drops the core in
//   style  - sweeps the hero in order (headline, subhead, status line, panel)
//            bringing each from grey to its real colours, then fills the CV
//            button with the accent. It waits for copy before the panel.
// Then all four fly together and merge into the one accent agent cursor, which
// settles by the command bar.
// Whether it plays at all is decided before first paint by the boot script
// (components/intro/boot-script.tsx). This chunk only runs a "pending" intro.
// Any click, key or scroll ends it, and the hero snaps to its final look.

declare global {
  interface Window {
    __introEnd?: () => void;
  }
}

const ROLES = ["layout", "copy", "media", "style"];

const DRIVER_WAIT_MS = 1500;
const FONT_WAIT_MS = 1000;

// ms. The critical path is copy's typing -> style's panel sweep -> CV -> merge,
// so the other three cursors gather while style is still on the CV button.
const T = {
  copyLead: 100,
  headline: 700,
  carriage: 90, // jump to the next line's start
  panelApproach: 240,
  hop: 80, // to the next panel element
  type: { greeting: 320, chip: 100, placeholder: 120 } as Record<string, number>,
  draw: 600,
  mediaLead: 400,
  drop: 600,
  styleLead: 450,
  sweepHop: 160,
  sweep: 220,
  ctaFly: 260,
  converge: 260,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** resolve when `p` does, or at once if the step is aborted */
function until(p: Promise<void>, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    void p.then(resolve);
    signal.addEventListener("abort", () => resolve());
  });
}

/** keep an aim point inside the viewport, so a cursor never flies off screen */
function clampAim(aim: Aim): Aim {
  return (r) => {
    const p = aim(r);
    return {
      x: Math.min(Math.max(p.x, 8), window.innerWidth - 24),
      y: Math.min(Math.max(p.y, 8), window.innerHeight - 24),
    };
  };
}

interface TypeOpts {
  /** typing time for the whole block */
  ms: number;
  /** a short straight hop to the first character; default: a normal flight */
  approachMs?: number;
  lines?: LineBox[];
  chars?: number;
}

/** the copy cursor types a block line by line, riding the end of the typed text */
function typeSteps(el: HTMLElement, o: TypeOpts): Step[] {
  const lines = o.lines ?? lineBoxes(el);
  if (!lines.length) return [{ kind: "run", fn: (s) => fadeIn(el, 300, s) }];
  const total = lines.reduce((n, l) => n + (l.right - l.left), 0) || 1;
  const chars = o.chars ?? (el.textContent ?? "").length;
  const at = (l: LineBox, x: number) =>
    clampAim((r) => ({ x: r.left + x, y: r.top + (l.top + l.bottom) / 2 }));
  const move = (aim: Aim, ms?: number): Step => ({
    kind: "moveTo",
    cursor: "copy",
    target: el,
    scroll: false,
    straight: ms !== undefined,
    ms,
    aim,
  });

  const steps: Step[] = [move(at(lines[0], lines[0].left), o.approachMs)];
  lines.forEach((line, i) => {
    const share = (line.right - line.left) / total;
    const ms = Math.max(40, Math.round(o.ms * share));
    if (i > 0) steps.push(move(at(line, line.left), T.carriage));
    steps.push({
      kind: "parallel",
      tracks: [
        [{ kind: "run", fn: (s) => typeLine(el, lines, i, Math.round(chars * share), ms, s) }],
        [move(at(line, line.right), ms)],
      ],
    });
  });
  return steps;
}

/** the style cursor sweeps across an element while it takes its real colours */
function sweep(el: HTMLElement | null, tones: (HTMLElement | null)[], hopMs?: number): Step[] {
  const restyle: Step = { kind: "run", fn: () => tones.forEach(styleIn) };
  if (!el) return [restyle];
  const y = (r: DOMRect) => r.top + Math.min(r.height / 2, 40);
  return [
    {
      kind: "moveTo",
      cursor: "style",
      target: el,
      scroll: false,
      ms: hopMs,
      aim: clampAim((r) => ({ x: r.left, y: y(r) })),
    },
    {
      kind: "parallel",
      tracks: [
        [restyle],
        [
          {
            kind: "moveTo",
            cursor: "style",
            target: el,
            scroll: false,
            straight: true,
            ms: T.sweep,
            aim: clampAim((r) => ({ x: r.right, y: y(r) })),
          },
        ],
      ],
    },
  ];
}

function buildIntro(): Step[] {
  const frame = introPart("frame");
  const label = introPart("label");
  const headline = introPart("headline");
  const sub = introPart("sub");
  const status = introPart("status");
  const core = introPart("core");
  const cta = introTone("cta");
  const input = frame?.querySelector<HTMLInputElement>("input") ?? null;

  // copy -> style handoff: the panel is only styled once its text is typed
  let panelTyped!: () => void;
  const panelDone = new Promise<void>((r) => (panelTyped = r));

  const layout: Step[] = frame
    ? [
        {
          kind: "moveTo",
          cursor: "layout",
          target: frame,
          scroll: false,
          aim: clampAim((r) => ({ x: r.left, y: r.top })),
        },
        {
          kind: "parallel",
          tracks: [
            [
              {
                kind: "drag",
                cursor: "layout",
                from: frame,
                to: frame,
                scroll: false,
                fromAim: clampAim((r) => ({ x: r.left, y: r.top })),
                toAim: clampAim((r) => ({ x: r.right, y: r.bottom })),
                ms: T.draw,
              },
            ],
            [{ kind: "run", fn: (s) => drawFrame(frame, T.draw, s) }],
          ],
        },
      ]
    : [];

  // greeting, chip labels, placeholder - in DOM order. The style cursor is
  // released onto the panel as the last element starts typing: its hop there
  // takes about as long as that short placeholder, so the text is still all
  // typed (in grey) before the colour comes in.
  const panelText = frame
    ? Array.from(frame.querySelectorAll<HTMLElement>("[data-intro-type]"))
    : [];
  const lastText = panelText.length - 1;
  const copy: Step[] = [
    { kind: "wait", ms: T.copyLead },
    { kind: "run", fn: () => void fadeIn(label, 300) },
    ...(headline ? typeSteps(headline, { ms: T.headline }) : []),
    { kind: "run", fn: () => void Promise.all([fadeIn(sub, 380), fadeIn(status, 380, undefined, 120)]) },
    ...panelText.flatMap((el, k) => {
      const kind = el.dataset.introType ?? "chip";
      const isInput = el instanceof HTMLInputElement;
      const steps = typeSteps(el, {
        ms: T.type[kind] ?? T.type.chip,
        approachMs: k === 0 ? T.panelApproach : T.hop,
        lines: isInput ? inputLines(el) : undefined,
        chars: isInput ? el.placeholder.length : undefined,
      });
      return k === lastText ? [{ kind: "run", fn: () => panelTyped() } as Step, ...steps] : steps;
    }),
    { kind: "run", fn: () => panelTyped() }, // no panel text: release anyway
  ];

  const media: Step[] = [
    { kind: "wait", ms: T.mediaLead },
    ...(core
      ? ([
          { kind: "moveTo", cursor: "media", target: core, scroll: false },
          { kind: "click", cursor: "media" },
        ] satisfies Step[])
      : []),
    { kind: "run", fn: (s) => dropIn(core, T.drop, s) },
  ];

  const style: Step[] = [
    { kind: "wait", ms: T.styleLead },
    ...sweep(headline, [label, headline]),
    ...sweep(sub, [sub], T.sweepHop),
    ...sweep(status, [status], T.sweepHop),
    { kind: "run", fn: (s) => until(panelDone, s) },
    ...sweep(frame, [introTone("panel")], T.sweepHop),
  ];

  // the hand-over spot: the command input, or the panel if the input is below
  // the fold (phones)
  const spot = () => (input && inViewport(input) ? input : frame);
  const spotAim = clampAim((r) => ({ x: r.left + 24, y: r.top + Math.min(r.height / 2, 24) }));
  const toSpot = (cursor: string, ms: number): Step => ({
    kind: "moveTo",
    cursor,
    target: spot,
    scroll: false,
    ms,
    aim: spotAim,
  });

  // style finishes on the CV button's accent, then joins the others
  const finale: Step[][] = [
    [
      ...(cta
        ? ([{ kind: "moveTo", cursor: "style", target: cta, scroll: false, ms: T.ctaFly }] satisfies Step[])
        : []),
      { kind: "run", fn: () => styleIn(cta) },
      toSpot("style", T.converge),
    ],
    // the rest gather over the same time, arriving together with style
    ...ROLES.filter((c) => c !== "style").map((c) => [toSpot(c, T.ctaFly + T.converge)]),
  ];

  return [
    { kind: "parallel", tracks: [layout, copy, media, style] },
    { kind: "parallel", tracks: finale },
    { kind: "merge", cursors: ROLES, into: DEFAULT_CURSOR, target: spot, aim: spotAim },
  ];
}

export function BootIntro() {
  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro !== "pending") return;

    let ended = false;
    let playing = false;
    // unmounted before it started (React Strict Mode mounts effects twice in
    // dev): leave data-intro alone so the next mount can still play it
    let disposed = false;

    // ends the intro for whatever reason; idempotent. The boot script's end
    // removes data-intro with transitions snapped off, and the reveals are
    // cancelled in the same task, so the hero lands on its final look at once.
    const end = () => {
      if (ended) return;
      ended = true;
      observer.disconnect();
      if (window.__introEnd) window.__introEnd();
      else html.removeAttribute("data-intro");
      stopReveals();
      if (playing) choreo.cancel();
    };

    // the boot script removed data-intro: skip, click, key, scroll or failsafe
    const observer = new MutationObserver(() => {
      if (!html.hasAttribute("data-intro")) end();
    });
    observer.observe(html, { attributes: true, attributeFilter: ["data-intro"] });

    void (async () => {
      // a reload restores scroll after the boot script ran: only play on the hero
      if (prefersReducedMotion() || window.scrollY > 40) return end();
      const hasDriver = await choreo.waitForDriver(DRIVER_WAIT_MS);
      // line breaks must be final before text is measured: wait for the
      // headline's own face (next/font swaps it in late)
      const headline = introPart("headline");
      await Promise.race([
        headline && document.fonts
          ? document.fonts.load(getComputedStyle(headline).font, headline.textContent ?? "").catch(() => {})
          : null,
        sleep(FONT_WAIT_MS),
      ]);
      if (ended || disposed) return;
      if (!hasDriver || choreo.busy || html.dataset.intro !== "pending") return end();

      html.dataset.intro = "running";
      playing = true;
      await choreo.enqueue(buildIntro());
      playing = false;
      end();
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      if (playing) end();
    };
  }, []);

  return null;
}

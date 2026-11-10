"use client";

import { useEffect } from "react";
import { choreo, prefersReducedMotion, type Aim, type Step } from "@/lib/agent/choreo";
import {
  accentIn,
  drawFrame,
  dropIn,
  fadeIn,
  introPart,
  lineBoxes,
  stopReveals,
  typeLine,
} from "@/lib/intro/reveal";

// The boot intro (~4s): four role cursors assemble the hero on the shared
// cursor engine, revealing the real, already-rendered hero.
//   layout - drags the command panel's frame out from its corner
//   copy   - types the headline line by line, then brings in the sub copy
//   media  - drops the core in
//   style  - gives the primary CTA its accent
// Whether it plays at all is decided before first paint by the boot script
// (components/intro/boot-script.tsx). This chunk only runs a "pending" intro.
// Any click, key or scroll ends it, and every hidden part snaps to its final look.

declare global {
  interface Window {
    __introEnd?: () => void;
  }
}

const DRIVER_WAIT_MS = 1500;
const FONT_WAIT_MS = 1000;
const DRAW_MS = 700;
const TYPE_CHAR_MS = 32;
const CARRIAGE_MS = 140;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

function headlineSteps(el: HTMLElement): Step[] {
  const lines = lineBoxes(el);
  if (!lines.length) return [{ kind: "run", fn: (s) => fadeIn(el, 400, s) }];
  const total = lines.reduce((n, l) => n + (l.right - l.left), 0) || 1;
  const chars = (el.textContent ?? "").length;
  const typeMs = Math.min(1500, Math.max(900, chars * TYPE_CHAR_MS));
  const steps: Step[] = [];

  lines.forEach((line, i) => {
    const share = (line.right - line.left) / total;
    const ms = Math.round(typeMs * share);
    const mid = (line.top + line.bottom) / 2;
    if (i > 0) {
      // carriage return: the caret-cursor jumps to the next line's start
      steps.push({
        kind: "moveTo",
        cursor: "copy",
        target: el,
        scroll: false,
        straight: true,
        ms: CARRIAGE_MS,
        aim: clampAim((r) => ({ x: r.left + line.left, y: r.top + mid })),
      });
    }
    steps.push({
      kind: "parallel",
      tracks: [
        [{ kind: "run", fn: (s) => typeLine(el, lines, i, Math.round(chars * share), ms, s) }],
        [
          {
            kind: "moveTo",
            cursor: "copy",
            target: el,
            scroll: false,
            straight: true,
            ms,
            aim: clampAim((r) => ({ x: r.left + line.right, y: r.top + mid })),
          },
        ],
      ],
    });
  });
  return steps;
}

function buildIntro(): Step[] {
  const frame = introPart("frame");
  const label = introPart("label");
  const headline = introPart("headline");
  const sub = introPart("sub");
  const status = introPart("status");
  const core = introPart("core");
  const cta = introPart("cta");

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
                ms: DRAW_MS,
              },
            ],
            [{ kind: "run", fn: (s) => drawFrame(frame, DRAW_MS, s) }],
          ],
        },
      ]
    : [];

  const firstLine = headline ? lineBoxes(headline)[0] : undefined;
  const copy: Step[] = [
    { kind: "wait", ms: 150 },
    ...(headline
      ? ([
          {
            kind: "moveTo",
            cursor: "copy",
            target: headline,
            scroll: false,
            aim: clampAim((r) =>
              firstLine
                ? { x: r.left + firstLine.left, y: r.top + (firstLine.top + firstLine.bottom) / 2 }
                : { x: r.left, y: r.top }
            ),
          },
          { kind: "click", cursor: "copy" },
          { kind: "run", fn: () => void fadeIn(label, 300) },
          ...headlineSteps(headline),
        ] satisfies Step[])
      : [{ kind: "run", fn: () => void fadeIn(label, 300) } satisfies Step]),
    ...(sub
      ? ([
          { kind: "moveTo", cursor: "copy", target: sub, scroll: false },
          { kind: "click", cursor: "copy" },
        ] satisfies Step[])
      : []),
    {
      kind: "run",
      fn: (s) => Promise.all([fadeIn(sub, 420, s), fadeIn(status, 420, s, 120)]).then(() => {}),
    },
  ];

  const media: Step[] = [
    { kind: "wait", ms: 500 },
    ...(core
      ? ([
          { kind: "moveTo", cursor: "media", target: core, scroll: false },
          { kind: "click", cursor: "media" },
        ] satisfies Step[])
      : []),
    { kind: "run", fn: (s) => dropIn(core, 650, s) },
  ];

  const style: Step[] = [
    { kind: "wait", ms: 1700 },
    ...(cta
      ? ([
          { kind: "moveTo", cursor: "style", target: cta, scroll: false },
          { kind: "click", cursor: "style" },
        ] satisfies Step[])
      : []),
    { kind: "run", fn: (s) => accentIn(cta, 450, s) },
  ];

  return [{ kind: "parallel", tracks: [layout, copy, media, style] }];
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

    // ends the intro for whatever reason; idempotent. Removing data-intro and
    // cancelling the reveals happen in one task, so nothing flashes.
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
      // line breaks must be final before the headline is measured: wait for
      // the headline's own face (next/font swaps it in late)
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

"use client";

import { useEffect } from "react";
import {
  choreo,
  DEFAULT_CURSOR,
  prefersReducedMotion,
  type Point,
  type Step,
} from "@/lib/agent/choreo";
import { bowControl, CURSOR_ROLES } from "@/components/agent/cursor";
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

// The boot intro (~6s): four role cursors, each in its own colour, assemble the
// real, already-rendered hero on the shared cursor engine. Everything starts as
// a grey wireframe.
//   layout - drags the command panel's frame out from its corner, then sets
//            its controls: the suggestion chips and the input field
//   copy   - types the headline line by line, then the panel's greeting, the
//            cursor gliding along each line as it types
//   media  - drops the core in
//   style  - gives the CV button its accent, then sweeps the hero from grey to
//            its real colours: the headline stack (the headline sits grey for
//            GREY_MS after copy finishes it), then the panel once copy has left
// Each cursor, as soon as its own work is done, flies to the command bar and
// docks into the one accent agent cursor there. The agent appears with the
// first dock and stays; copy has the most to do and arrives last.
//
// Every target is measured once, after fonts load and before anything moves;
// the typed elements already have their final size (they are clipped, never
// resized), so no cursor has to re-aim mid-flight.
// Whether it plays at all is decided before first paint by the boot script
// (components/intro/boot-script.tsx). This chunk only runs a "pending" intro.
// Any click, key or scroll ends it, and the hero snaps to its final look.
// Progress is marked with performance.mark("intro:...") for scripts/test-intro.ts.

declare global {
  interface Window {
    __introEnd?: () => void;
  }
}

const DRIVER_WAIT_MS = 1500;
const FONT_WAIT_MS = 1500;

// ms
const T = {
  /**
   * no flight is shorter; longer ones get slower so the eased peak (about 2.9x
   * the average speed on the bowed path) stays well under a jump
   */
  flightMin: 450,
  flightMax: 1100,
  flightBase: 200,
  flightPerPx: 0.75,
  /**
   * copy's carriage return, from the end of a typed line to the start of the
   * next: straight and linear at about the typing glide's own speed, so typing
   * and returning read as one continuous motion
   */
  carriagePxPerMs: 1.4,
  /** typing pace, per character */
  headlineChar: 32,
  greetingChar: 21,
  /** copy's last flight, from the greeting to the dock, so it lands last */
  copyExit: 650,
  /** the headline stays grey this long after copy finishes it */
  grey: 1000,
  draw: 800,
  mediaLead: 300,
  drop: 600,
  styleLead: 1500,
  panelSweep: 450,
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

const mark = (name: string) => performance.mark(`intro:${name}`);
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** a flight's duration: never under T.flightMin, slower the further it goes */
const flightMs = (a: Point, b: Point) =>
  Math.round(clamp(T.flightBase + dist(a, b) * T.flightPerPx, T.flightMin, T.flightMax));

/** a sweep or field glide: linear, so a little slower than a flight */
const sweepMs = (a: Point, b: Point, min: number, max: number) =>
  Math.round(clamp(min + dist(a, b) * 0.6, min, max));

/** keep a point inside the viewport, so a cursor never flies off screen */
function onScreen(p: Point): Point {
  return {
    x: clamp(p.x, 8, window.innerWidth - 24),
    y: clamp(p.y, 8, window.innerHeight - 24),
  };
}

function shown(r: DOMRect | undefined): r is DOMRect {
  return (
    !!r &&
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  );
}

/** resolve when `p` does (plus `extra` ms after the time it carries), or on abort */
function until(p: Promise<unknown>, signal: AbortSignal, extra = 0) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", () => resolve());
    void p.then((at) => {
      const left = typeof at === "number" ? at + extra - performance.now() : 0;
      void sleep(Math.max(0, left), signal).then(resolve);
    });
  });
}

/** a one-shot handoff between tracks that carries the time it was given */
function handoff() {
  let give!: () => void;
  const done = new Promise<number>((r) => (give = () => r(performance.now())));
  return { done, give };
}

/** run effects at fractions of `ms`, in step with a glide of the same length */
function onCue(ms: number, cues: [number, () => void][], signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timers = cues.map(([f, fn]) => setTimeout(fn, Math.round(clamp(f, 0, 1) * ms)));
    const end = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
      resolve();
    });
  });
}

/** how far along the segment a→b the point p projects, 0..1 */
function along(a: Point, b: Point, p: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  return len ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0;
}

/** one cursor's steps, built in order with its planned position tracked */
class Track {
  readonly steps: Step[] = [];
  at: Point;

  constructor(readonly cursor: string) {
    const spawn = CURSOR_ROLES.find((r) => r.id === cursor)?.spawn;
    this.at = spawn
      ? spawn(window.innerWidth, window.innerHeight)
      : { x: -24, y: window.innerHeight / 2 };
  }

  private move(el: HTMLElement, to: Point, ms: number, straight: boolean) {
    const p = onScreen(to);
    // bow the path into the page, never out past its edge
    const c = bowControl(this.at, p);
    const out = c.x < 0 || c.y < 0 || c.x > window.innerWidth || c.y > window.innerHeight;
    this.steps.push({
      kind: "moveTo",
      cursor: this.cursor,
      target: el,
      scroll: false,
      aim: () => p,
      ms,
      straight,
      bowSide: out ? -1 : 1,
    });
    this.at = p;
  }

  /** an eased, curved flight: `ms`, else timed by distance; never under the floor */
  fly(el: HTMLElement, to: Point, ms?: number) {
    const p = onScreen(to);
    this.move(el, p, Math.max(T.flightMin, ms ?? flightMs(this.at, p)), false);
  }

  /** a straight, linear move with no effect (copy's carriage return) */
  slide(el: HTMLElement, to: Point, ms: number) {
    this.move(el, to, Math.max(T.flightMin, ms), true);
  }

  /** a straight, linear glide with an effect running over exactly the same time */
  glide(el: HTMLElement, to: Point, ms: number, effect: (s: AbortSignal) => void | Promise<void>) {
    const p = onScreen(to);
    const move: Step = {
      kind: "moveTo",
      cursor: this.cursor,
      target: el,
      scroll: false,
      aim: () => p,
      ms,
      straight: true,
    };
    this.steps.push({ kind: "parallel", tracks: [[{ kind: "run", fn: effect }], [move]] });
    this.at = p;
  }

  run(fn: (s: AbortSignal) => void | Promise<void>) {
    this.steps.push({ kind: "run", fn });
  }

  wait(ms: number) {
    this.steps.push({ kind: "wait", ms });
  }

  click() {
    this.steps.push({ kind: "click", cursor: this.cursor });
  }

  /** fly to the hand-over spot (taking at least `minMs`) and dock into the agent */
  dock(spot: Spot, minMs = 0) {
    this.fly(spot.el, spot.at, Math.max(minMs, flightMs(this.at, onScreen(spot.at))));
    this.run(() => void mark(`dock:${this.cursor}`));
    this.steps.push({
      kind: "dock",
      cursor: this.cursor,
      into: DEFAULT_CURSOR,
      target: spot.el,
      aim: () => spot.at,
    });
  }
}

interface Block {
  el: HTMLElement;
  rect: DOMRect;
  lines: LineBox[];
  chars: number;
}

interface Spot {
  el: HTMLElement;
  at: Point;
}

function block(el: HTMLElement | null): Block | null {
  if (!el) return null;
  return {
    el,
    rect: el.getBoundingClientRect(),
    lines: lineBoxes(el),
    chars: (el.textContent ?? "").length,
  };
}

/**
 * copy types a block line by line: one linear glide per line, timed by its
 * share of the characters, with a linear carriage return between lines
 */
function typeBlock(copy: Track, b: Block, charMs: number) {
  const { el, rect, lines } = b;
  if (!shown(rect) || !lines.length) {
    copy.run((s) => fadeIn(el, 400, s));
    return;
  }
  const total = lines.reduce((n, l) => n + (l.right - l.left), 0) || 1;
  lines.forEach((line, i) => {
    const y = rect.top + (line.top + line.bottom) / 2;
    const start = { x: rect.left + line.left, y };
    const end = { x: rect.left + line.right, y };
    if (i === 0) copy.fly(el, start);
    else copy.slide(el, start, dist(copy.at, onScreen(start)) / T.carriagePxPerMs);
    const chars = Math.max(1, Math.round((b.chars * (line.right - line.left)) / total));
    const ms = chars * charMs;
    copy.glide(el, end, ms, (s) => typeLine(el, lines, i, chars, ms, s));
  });
}

function buildIntro(): Step[] {
  const label = introPart("label");
  const headlineEl = introPart("headline");
  const sub = introPart("sub");
  const status = introPart("status");
  const core = introPart("core");
  const frame = introPart("frame");
  const cta = introTone("cta");
  const panel = introTone("panel");
  const input = frame?.querySelector<HTMLInputElement>("input") ?? null;
  const greetingEl = frame?.querySelector<HTMLElement>('[data-intro-type="greeting"]') ?? null;
  const chips = frame
    ? Array.from(frame.querySelectorAll<HTMLElement>('[data-intro-type="chip"]'))
    : [];

  // ---- measure everything once, before anything moves ----------------------
  const headline = block(headlineEl);
  const greeting = block(greetingEl);
  const frameR = frame?.getBoundingClientRect();
  const inputR = input?.getBoundingClientRect();
  const coreR = core?.getBoundingClientRect();
  const ctaR = cta?.getBoundingClientRect();
  const statusR = status?.getBoundingClientRect();
  const statusLines = status ? lineBoxes(status) : [];
  const chipRs = chips.map((c) => c.getBoundingClientRect());

  // the hand-over spot: the command input if it is fully on screen, else the
  // panel's corner (phones, where the input sits at the fold)
  const inputFull = shown(inputR) && inputR.bottom <= window.innerHeight - 8;
  const spot: Spot | null =
    input && inputFull
      ? { el: input, at: { x: inputR.left + 24, y: inputR.top + inputR.height / 2 } }
      : frame && shown(frameR)
        ? { el: frame, at: onScreen({ x: frameR.left + 24, y: frameR.top + 24 }) }
        : null;

  // copy -> style and layout -> style handoffs
  const headlineTyped = handoff();
  const greetingLeft = handoff();
  const frameDrawn = handoff();
  const controlsSet = handoff();

  // ---- layout: frame, then chips and the input field ------------------------
  const layout = new Track("layout");
  if (frame && shown(frameR)) {
    const tl = onScreen({ x: frameR.left, y: frameR.top });
    const br = onScreen({ x: frameR.right, y: frameR.bottom });
    layout.fly(frame, tl);
    layout.steps.push({
      kind: "parallel",
      tracks: [
        [
          {
            kind: "drag",
            cursor: "layout",
            from: frame,
            to: frame,
            scroll: false,
            fromAim: () => tl,
            toAim: () => br,
            ms: T.draw,
          },
        ],
        [{ kind: "run", fn: (s) => drawFrame(frame, T.draw, s) }],
      ],
    });
    layout.at = br;
  } else {
    layout.run((s) => drawFrame(frame, 300, s));
  }
  layout.run(() => frameDrawn.give());

  const chipsOn = chips.filter((_, i) => shown(chipRs[i]));
  if (chipsOn.length) {
    const first = chipRs[chips.indexOf(chipsOn[0])];
    const last = chipRs[chips.indexOf(chipsOn[chipsOn.length - 1])];
    const a = onScreen({ x: first.left, y: first.top + first.height / 2 });
    const b = onScreen({ x: last.right, y: last.top + last.height / 2 });
    const ms = sweepMs(a, b, 500, 900);
    layout.fly(chipsOn[0], a);
    layout.glide(chipsOn[chipsOn.length - 1], b, ms, (s) =>
      onCue(
        ms,
        chipsOn.map((el) => {
          const r = el.getBoundingClientRect();
          return [along(a, b, { x: r.left, y: r.top + r.height / 2 }), () => void fadeIn(el, 350, s)];
        }),
        s
      )
    );
  }
  chips.filter((c) => !chipsOn.includes(c)).forEach((el) => layout.run((s) => void fadeIn(el, 350, s)));

  if (input && shown(inputR)) {
    const lines = inputLines(input);
    const y = inputR.top + inputR.height / 2;
    const a = { x: inputR.left + lines[0].left, y };
    const b = { x: inputR.left + lines[0].right, y };
    const ms = sweepMs(a, b, 450, 700);
    layout.fly(input, a);
    // a smooth wipe: the field is drawn in, not typed
    layout.glide(input, b, ms, (s) => typeLine(input, lines, 0, 0, ms, s));
  } else if (input) {
    layout.run((s) => void fadeIn(input, 350, s));
  }
  layout.run(() => controlsSet.give());
  if (spot) layout.dock(spot);

  // ---- copy: headline, then the greeting ------------------------------------
  const copy = new Track("copy");
  copy.run((s) => void fadeIn(label, 400, s));
  if (headline) typeBlock(copy, headline, T.headlineChar);
  copy.run((s) => {
    mark("headline-typed");
    headlineTyped.give();
    void fadeIn(sub, 400, s);
    void fadeIn(status, 400, s, 120);
  });
  copy.run((s) => until(frameDrawn.done, s));
  if (greeting) typeBlock(copy, greeting, T.greetingChar);
  copy.run(() => {
    mark("greeting-typed");
    greetingLeft.give();
  });
  if (spot) copy.dock(spot, T.copyExit);

  // ---- media: the core ------------------------------------------------------
  const media = new Track("media");
  if (core && shown(coreR)) {
    media.wait(T.mediaLead);
    media.fly(core, { x: coreR.left + coreR.width / 2, y: coreR.top + coreR.height / 2 });
    media.click();
    media.run((s) => dropIn(core, T.drop, s));
    if (spot) media.dock(spot);
  } else {
    // nothing to do on screen (the core is hidden on phones): no cursor
    media.run((s) => dropIn(core, T.drop, s));
  }

  // ---- style: CV accent, the headline stack, then the panel -----------------
  const style = new Track("style");
  style.wait(T.styleLead);
  if (cta && shown(ctaR)) {
    style.fly(cta, { x: ctaR.left + ctaR.width / 2, y: ctaR.top + ctaR.height / 2 });
    style.click();
  }
  style.run(() => styleIn(cta));

  if (headline && shown(headline.rect)) {
    const l0 = headline.lines[0];
    const a = {
      x: headline.rect.left + (l0?.left ?? 0),
      y: headline.rect.top + (l0 ? (l0.top + l0.bottom) / 2 : 24),
    };
    const lastStatus = statusLines[statusLines.length - 1];
    const b =
      statusR && shown(statusR)
        ? {
            x: statusR.left + (lastStatus?.right ?? statusR.width),
            y: statusR.top + statusR.height / 2,
          }
        : { x: headline.rect.right, y: headline.rect.bottom };
    const ms = Math.round(clamp(400 + dist(a, b) * 0.6, 600, 900));
    const cue = (el: HTMLElement | null) => {
      const r = el?.getBoundingClientRect();
      return r ? along(a, b, { x: a.x, y: r.top }) : 1;
    };
    style.fly(headline.el, a);
    // copy has left the headline; let it sit grey a while longer
    style.run((s) => until(headlineTyped.done, s, T.grey));
    style.run(() => void mark("headline-styled"));
    style.glide(status ?? headline.el, b, ms, (s) =>
      onCue(
        ms,
        [
          [0, () => [label, headline.el].forEach(styleIn)],
          [cue(sub), () => styleIn(sub)],
          [cue(status), () => styleIn(status)],
        ],
        s
      )
    );
  } else {
    style.run((s) => until(headlineTyped.done, s));
    style.run(() => [label, headlineEl, sub, status].forEach(styleIn));
  }

  if (frame && shown(frameR) && spot) {
    // wait at a top corner of the panel until copy and layout are done in it:
    // above the input (desktop) the near one, so style is always there first;
    // when the spot is the panel's own corner (phones), the far one
    const a = onScreen({
      x: inputFull ? frameR.left + 24 : frameR.right - 24,
      y: frameR.top + 16,
    });
    style.fly(frame, a);
    style.run((s) => until(Promise.all([greetingLeft.done, controlsSet.done]), s));
    style.run(() => void mark("panel-styled"));
    // sweeps down the panel and ends on the hand-over spot
    style.glide(frame, spot.at, T.panelSweep, () => styleIn(panel));
    style.run(() => void mark("dock:style"));
    style.steps.push({ kind: "dock", cursor: "style", into: DEFAULT_CURSOR, target: spot.el, aim: () => spot.at });
  } else {
    style.run((s) => until(Promise.all([greetingLeft.done, controlsSet.done]), s));
    style.run(() => styleIn(panel));
    if (spot) style.dock(spot);
  }

  return [{ kind: "parallel", tracks: [layout.steps, copy.steps, media.steps, style.steps] }];
}

/** wait out the heavy first frames, so no cursor starts mid-flight after a stall */
function settleFrames(maxMs: number) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    let last = start;
    let calm = 0;
    const tick = (now: number) => {
      calm = now - last < 25 ? calm + 1 : 0;
      last = now;
      if (calm >= 3 || now - start > maxMs) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
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
      // every line break and box must be final before anything is measured:
      // wait for all faces (next/font swaps them in late)
      await Promise.race([document.fonts?.ready, sleep(FONT_WAIT_MS)]);
      if (ended || disposed) return;
      if (!hasDriver || choreo.busy || html.dataset.intro !== "pending") return end();

      html.dataset.intro = "running";
      await settleFrames(600);
      if (ended || disposed) return;
      playing = true;
      mark("start");
      await choreo.enqueue(buildIntro());
      mark("end");
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

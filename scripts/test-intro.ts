import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";

// Browser checks for the boot intro. Plays it once per viewport (1440x900 and
// 390x844) in real Chrome, records every cursor's position on every frame plus
// the engine's flights (window.__cursorTrace) and the intro's own marks
// (performance.mark("intro:...")), then checks:
//   - the whole intro fits the budget (about 6s)
//   - no flight is shorter than 450ms; glides stay at a readable speed
//   - no cursor jumps: at most 60px per 60Hz frame while visible, and no
//     visible cursor leaves the viewport
//   - copy glides along each line: one move per line, never one per character,
//     and it keeps moving the whole time it types; typing is paced to be read
//   - the cursors dock one by one, copy last; the agent appears with the first
//     dock and stays
//   - nothing reflows while the intro runs (layout boxes, not transforms)
//   - style never colours what copy is still on: the headline sits grey for at
//     least a second after it is typed, the panel waits for copy to leave
//   - no fast-forward or scroll hold unless the visitor scrolled
// Then scroll during the intro (1440 unless noted):
//   - a wheel at 0.2s and at 3s: absorbed; the rest fast-forwards and ends on
//     its own (every cursor still docks) within the 1.2s hold; the page never
//     scrolls during it or lurches after it; scrolling works again after
//   - more wheels and scroll keys during the fast-forward: all absorbed, none
//     replayed, the hold is not extended
//   - an arrow key fast-forwards; Escape still ends at once
//   - a touch scroll at 0.2s on a 390 phone with touch: same as a wheel
//   - the cap: with the fast-forward stalled, the hold is released at 1.2s
//     and the hero jumps to its final state
// Needs a production build: npm run build && npm run test:intro
// INTRO_URL=http://localhost:3000/ uses a server that is already running.

const BUDGET_MS = 6500;
const MIN_FLIGHT_MS = 450;
const MAX_GLIDE_PX_S = 2000;
const MAX_STEP_PX = 60; // per 60Hz frame
const MIN_CHAR_MS = 20;
const HEADLINE_GREY_MS = 1000;
const DOCK_GAP_MS = 150;
const HOLD_MS = 1200;
/** timer slack when checking the hold's end */
const HOLD_SLACK_MS = 80;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

interface Sample {
  t: number;
  /** window.scrollY */
  y: number;
  intro: string | null;
  cursors: Record<string, { x: number; y: number; o: number }>;
  boxes: string;
}
interface TraceEntry {
  kind: "move" | "dock";
  id: string;
  t: number;
  ms?: number;
  straight?: boolean;
  from?: { x: number; y: number };
  to: { x: number; y: number };
}
interface Recording {
  /** when data-intro went away (the intro ended, any way) */
  gone: number;
  /** scrollY after the release check (a scroll once the intro is over), if run */
  releasedY: number | null;
  /** when Escape was pressed, if it was */
  escAt: number;
  /** scroll input (wheel, touchmove, keys) the page absorbed while the intro ran */
  absorbed: number;
  /** what is not in its final state once the intro is over (empty: all good) */
  final: string[];
  samples: Sample[];
  trace: TraceEntry[];
  marks: Record<string, number>;
  styled: Record<string, number>;
  text: { headline: number; greeting: number; headlineLines: number; greetingLines: number };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function startServer(): Promise<{ url: string; proc?: ChildProcess }> {
  if (process.env.INTRO_URL) return { url: process.env.INTRO_URL };
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("no production build: run `npm run build` first (or set INTRO_URL)");
  }
  const port = await freePort();
  const proc = spawn("npx", ["next", "start", "-p", String(port)], { stdio: "pipe" });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return { url, proc };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("next start did not come up");
}

async function launch(): Promise<Browser> {
  // real Chrome first: the bundled headless shell rasterises in software and
  // drops frames that a visitor's browser never would
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

interface Act {
  page: Page;
  /** resolves once the intro has run `ms` since its start mark */
  at: (ms: number) => Promise<void>;
  /** a trusted wheel over the middle of the page */
  wheel: (dy?: number) => Promise<void>;
  /** a trusted one-finger swipe up (scrolls the page down), via CDP */
  swipe: () => Promise<void>;
}

interface PlayOptions {
  touch?: boolean;
  /** what the visitor does once the intro has started */
  act?: (a: Act) => Promise<void>;
  /** after the intro: scroll once to check scrolling was released */
  release?: boolean;
}

async function swipeOn(cdp: CDPSession, x: number, y0: number, y1: number) {
  const steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function record(
  browser: Browser,
  url: string,
  width: number,
  height: number,
  opts: PlayOptions = {}
): Promise<Recording> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch,
  });
  const page = await context.newPage();
  const cdp = opts.touch ? await context.newCDPSession(page) : null;
  // tsx compiles with keepNames, which wraps functions passed to the page in a
  // __name() helper that only exists in Node
  await page.addInitScript("globalThis.__name = (f) => f;");
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__cursorTrace = [];
    const samples: unknown[] = [];
    const styled: Record<string, number> = {};
    const rec: Record<string, unknown> = { samples, styled, gone: 0, escAt: 0, absorbed: 0 };
    // bubble phase: runs after the boot script's capture listeners have had their say
    ["wheel", "touchmove", "keydown"].forEach((type) =>
      addEventListener(
        type,
        (e) => {
          if (e.defaultPrevented && document.documentElement.hasAttribute("data-intro")) {
            rec.absorbed = (rec.absorbed as number) + 1;
          }
        },
        { passive: true }
      )
    );
    addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && !rec.escAt) rec.escAt = performance.now();
      },
      true
    );
    w.__introRec = rec;
    // the init script runs before <html> exists: watch the document instead
    new MutationObserver(() => {
      const html = document.documentElement;
      if (!rec.gone && html && !html.hasAttribute("data-intro")) rec.gone = performance.now();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-intro"] });
    const boxEls = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-intro-part], [data-intro-type], [data-intro-tone]"
        )
      );
    // layout boxes only: offset* ignore transforms, so a rise or drop is not a reflow
    const boxes = () =>
      boxEls()
        .map((el) => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight].join(","))
        .join("|");
    // stamped with the frame's own time (what Framer animates against), not
    // the moment the callback happens to run
    const tick = (frameTime: number) => {
      const cursors: Record<string, { x: number; y: number; o: number }> = {};
      document.querySelectorAll<HTMLElement>(".agent-cursor").forEach((el) => {
        const id = el.querySelector(".agent-cursor-label")?.textContent ?? "?";
        const r = el.getBoundingClientRect();
        cursors[id] = { x: r.left, y: r.top, o: Number(getComputedStyle(el).opacity) };
      });
      samples.push({
        t: frameTime,
        y: window.scrollY,
        intro: document.documentElement.dataset.intro ?? null,
        cursors,
        boxes: boxes(),
      });
      if (performance.now() < 20000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        const name = el.dataset.introTone;
        if (name && el.hasAttribute("data-intro-styled") && !(name in styled)) {
          styled[name] = performance.now();
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-intro-styled"] });
  });

  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => performance.getEntriesByName("intro:start").length > 0, null, {
    timeout: 8000,
  });
  await page.mouse.move(width / 2, height / 2);
  const act: Act = {
    page,
    at: (ms) =>
      page
        .waitForFunction(
          (t) => performance.now() - performance.getEntriesByName("intro:start")[0].startTime >= t,
          ms,
          { polling: "raf" }
        )
        .then(() => {}),
    wheel: (dy = 400) => page.mouse.wheel(0, dy),
    swipe: () => swipeOn(cdp!, width / 2, height * 0.7, height * 0.3),
  };
  if (opts.act) await opts.act(act);
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-intro"), null, {
    timeout: 15000,
  });
  // long enough to see any lurch after the hold ends
  await page.waitForTimeout(600);
  let releasedY: number | null = null;
  if (opts.release) {
    await (opts.touch ? act.swipe() : act.wheel(300));
    await page.waitForTimeout(600);
    releasedY = await page.evaluate(() => window.scrollY);
  }
  const rec = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const { samples, styled, gone, escAt, absorbed } = w.__introRec as {
      samples: unknown[];
      styled: Record<string, number>;
      gone: number;
      escAt: number;
      absorbed: number;
    };
    // the hero's final look: everything shown, nothing animating or held
    const final: string[] = [];
    const html = document.documentElement;
    ["data-intro", "data-intro-ff", "data-intro-snap"].forEach(
      (a) => html.hasAttribute(a) && final.push(`html still has ${a}`)
    );
    document.querySelectorAll<HTMLElement>("[data-intro-part], [data-intro-type]").forEach((el) => {
      const name = el.dataset.introPart ?? el.dataset.introType;
      const cs = getComputedStyle(el);
      if (cs.opacity !== "1") final.push(`${name} opacity ${cs.opacity}`);
      if (cs.clipPath !== "none") final.push(`${name} clipped`);
      if (el.getAnimations().length) final.push(`${name} still animating`);
    });
    if (document.querySelector("[data-intro-styled]")) final.push("data-intro-styled left over");
    const marks: Record<string, number> = {};
    performance
      .getEntriesByType("mark")
      .filter((m) => m.name.startsWith("intro:"))
      .forEach((m) => (marks[m.name.slice(6)] = m.startTime));
    const lines = (el: Element | null) => {
      if (!el) return 0;
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set(
        Array.from(r.getClientRects())
          .filter((x) => x.width > 0)
          .map((x) => Math.round(x.top / 6))
      ).size;
    };
    const headline = document.querySelector('[data-intro-part="headline"]');
    const greeting = document.querySelector('[data-intro-part="frame"] [data-intro-type="greeting"]');
    return {
      gone,
      escAt,
      absorbed,
      final,
      samples,
      trace: w.__cursorTrace,
      marks,
      styled,
      text: {
        headline: headline?.textContent?.length ?? 0,
        greeting: greeting?.textContent?.length ?? 0,
        headlineLines: lines(headline),
        greetingLines: lines(greeting),
      },
    };
  });
  await context.close();
  return { ...(rec as Recording), releasedY };
}

function check(rec: Recording, label: string, vw: number, vh: number) {
  const failures: string[] = [];
  const expect = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg);
  };
  const { marks, trace, samples } = rec;
  const start = marks.start;
  const end = marks.end;
  const rel = (t: number) => Math.round(t - start);
  const info: string[] = [];

  // budget
  expect(start !== undefined && end !== undefined, "intro start/end marks missing");
  const total = end - start;
  info.push(`total ${Math.round(total)}ms`);
  expect(total <= BUDGET_MS, `intro took ${Math.round(total)}ms (budget ${BUDGET_MS}ms)`);

  // flights and glides
  const moves = trace.filter((e) => e.kind === "move" && e.t >= start);
  const flights = moves.filter((m) => !m.straight);
  const glides = moves.filter((m) => m.straight);
  const shortest = Math.min(...flights.map((m) => m.ms ?? 0));
  info.push(`${flights.length} flights, shortest ${shortest}ms`);
  flights
    .filter((m) => (m.ms ?? 0) < MIN_FLIGHT_MS)
    .forEach((m) => expect(false, `${m.id} flight of ${m.ms}ms at +${rel(m.t)}ms`));
  glides.forEach((m) => {
    const d = Math.hypot(m.to.x - m.from!.x, m.to.y - m.from!.y);
    const v = (d / (m.ms ?? 1)) * 1000;
    expect(v <= MAX_GLIDE_PX_S, `${m.id} glide at ${Math.round(v)}px/s at +${rel(m.t)}ms`);
  });

  // per-frame steps while running, normalised to a 60Hz frame
  const running = samples.filter((s) => s.t >= start && s.t <= end + 400);
  let maxStep = 0;
  let maxAt = "";
  let dropped = 0;
  // a cursor entering from its spawn point starts off screen; judge it from
  // the first frame it is fully on screen
  const entered = new Set<string>();
  const inside = (q: { x: number; y: number }) => q.x >= -2 && q.y >= -2 && q.x <= vw && q.y <= vh;
  for (let i = 1; i < running.length; i++) {
    const a = running[i - 1];
    const b = running[i];
    const dt = b.t - a.t;
    if (dt > 50) {
      dropped++;
      continue; // a stall, not a tween: reported, not judged as a jump
    }
    for (const id of Object.keys(b.cursors)) {
      const p = a.cursors[id];
      const q = b.cursors[id];
      if (q.o >= 0.3 && inside(q)) entered.add(id);
      if (q.o >= 0.3 && entered.has(id) && !inside(q)) {
        expect(false, `${id} off screen at (${Math.round(q.x)},${Math.round(q.y)}) +${rel(b.t)}ms`);
      }
      if (!p || p.o < 0.3 || q.o < 0.3) continue;
      const step = (Math.hypot(q.x - p.x, q.y - p.y) / dt) * (1000 / 60);
      if (step > maxStep) {
        maxStep = step;
        maxAt = `${id} +${rel(b.t)}ms`;
      }
      if (step > MAX_STEP_PX) {
        expect(false, `${id} jumped ${Math.round(step)}px/frame at +${rel(b.t)}ms`);
      }
    }
  }
  info.push(`max ${Math.round(maxStep)}px/frame (${maxAt}), ${dropped} long frames`);

  // copy glides along each line: one glide per line, never per character.
  // Its straight moves are those glides (left to right) and the carriage
  // returns between lines (right to left).
  const copyStraight = glides.filter((m) => m.id === "copy");
  const copyGlides = copyStraight.filter((m) => m.to.x > m.from!.x);
  const carriages = copyStraight.length - copyGlides.length;
  const lines = rec.text.headlineLines + rec.text.greetingLines;
  expect(
    copyGlides.length === lines,
    `copy made ${copyGlides.length} glides for ${lines} lines of text`
  );
  expect(
    carriages === lines - 2,
    `copy made ${carriages} carriage returns for ${lines} lines in two blocks`
  );
  // ... and keeps moving through each one: never still for two frames running
  // mid-line (one repeated frame is the compositor, not the glide)
  copyGlides.forEach((g) => {
    const inner = running.filter((s) => s.t > g.t + 50 && s.t < g.t + (g.ms ?? 0) - 50);
    for (let i = 2; i < inner.length; i++) {
      const o = inner[i - 2].cursors.copy;
      const p = inner[i - 1].cursors.copy;
      const q = inner[i].cursors.copy;
      if (inner[i].t - inner[i - 2].t > 60) continue;
      const still = (u?: { x: number; y: number }, v?: { x: number; y: number }) =>
        !!u && !!v && Math.hypot(v.x - u.x, v.y - u.y) < 0.05;
      if (still(o, p) && still(p, q)) {
        expect(false, `copy stood still mid-line at +${rel(inner[i].t)}ms`);
        break;
      }
    }
  });
  // typing pace: time spent gliding per character typed
  const headlineGlides = copyGlides.filter((g) => g.t < marks["headline-typed"]);
  const greetingGlides = copyGlides.filter((g) => g.t > marks["headline-typed"]);
  const pace = (gs: TraceEntry[], chars: number) =>
    chars ? gs.reduce((n, g) => n + (g.ms ?? 0), 0) / chars : Infinity;
  const headPace = pace(headlineGlides, rec.text.headline);
  const greetPace = pace(greetingGlides, rec.text.greeting);
  info.push(`typing ${Math.round(headPace)}ms/char headline, ${Math.round(greetPace)}ms/char greeting`);
  expect(headPace >= MIN_CHAR_MS, `headline typed at ${headPace.toFixed(1)}ms/char`);
  expect(greetPace >= MIN_CHAR_MS, `greeting typed at ${greetPace.toFixed(1)}ms/char`);

  // independent endings
  const roles = ["layout", "copy", "media", "style"];
  const seen = roles.filter((r) => moves.some((m) => m.id === r));
  const docks = seen
    .map((r) => ({ r, t: marks[`dock:${r}`] }))
    .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
  info.push(`docks ${docks.map((d) => `${d.r}@${rel(d.t)}`).join(" ")}`);
  docks.forEach((d) => expect(d.t !== undefined, `${d.r} never docked`));
  expect(docks[docks.length - 1]?.r === "copy", `copy is not last to dock`);
  for (let i = 1; i < docks.length; i++) {
    expect(
      docks[i].t - docks[i - 1].t >= DOCK_GAP_MS,
      `${docks[i - 1].r} and ${docks[i].r} docked ${Math.round(docks[i].t - docks[i - 1].t)}ms apart`
    );
  }
  const firstDock = docks[0]?.t ?? end;
  const agentOff = running.filter((s) => s.t > firstDock + 400 && s.t < end && (s.cursors.agent?.o ?? 0) < 0.9);
  expect(agentOff.length === 0, `agent not shown after the first dock (+${rel(agentOff[0]?.t ?? 0)}ms)`);
  const agentEarly = running.filter((s) => s.t < firstDock && (s.cursors.agent?.o ?? 0) > 0.05);
  expect(agentEarly.length === 0, `agent shown before the first dock`);

  // stable targets: no layout box changes while the intro runs
  const during = samples.filter((s) => s.t >= start && s.t <= end);
  const changed = during.findIndex((s, i) => i > 0 && s.boxes !== during[i - 1].boxes);
  expect(changed === -1, `layout changed at +${rel(during[changed]?.t ?? 0)}ms`);

  expect(marks.hold === undefined && marks.ff === undefined, "fast-forward without a scroll");
  rec.final.forEach((f) => expect(false, `final state: ${f}`));

  // no overlaps: style waits for copy
  const grey = rec.styled.headline - marks["headline-typed"];
  info.push(`headline grey ${Math.round(grey)}ms after typing`);
  expect(grey >= HEADLINE_GREY_MS - 20, `headline coloured ${Math.round(grey)}ms after typing`);
  expect(
    rec.styled.panel >= marks["greeting-typed"],
    `panel coloured ${Math.round(marks["greeting-typed"] - rec.styled.panel)}ms before copy left it`
  );

  console.log(`${failures.length ? "FAIL" : "ok  "} - ${label}: ${info.join("; ")}`);
  failures.forEach((f) => console.log(`       ${f}`));
  return failures.length;
}

type Ending = "fast-forward" | "cap" | "escape";

/** after a scroll or key during the intro */
function checkInput(rec: Recording, label: string, ending: Ending, minAbsorbed = 0) {
  const failures: string[] = [];
  const expect = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg);
  };
  const { marks, samples, trace } = rec;
  const rel = (t: number) => Math.round(t - marks.start);
  const info: string[] = [];

  if (ending === "escape") {
    expect(rec.escAt > 0, "Escape not pressed");
    const took = rec.gone - rec.escAt;
    info.push(`Escape at +${rel(rec.escAt)}ms ended it ${Math.round(took)}ms later`);
    expect(took <= 100, `Escape took ${Math.round(took)}ms to end it`);
    expect(marks.hold === undefined, "Escape started a scroll hold");
    expect(marks.end === undefined, "the intro played on after Escape");
  } else {
    const hold = marks.hold;
    expect(hold !== undefined, "no scroll hold started");
    const held = rec.gone - hold;
    info.push(`scroll at +${rel(hold)}ms, held ${Math.round(held)}ms`);
    expect(held <= HOLD_MS + HOLD_SLACK_MS, `scroll held ${Math.round(held)}ms (cap ${HOLD_MS}ms)`);

    if (ending === "fast-forward") {
      expect(marks.ff !== undefined, "the intro never fast-forwarded");
      expect(marks.cap === undefined, "fast-forward hit the cap instead of finishing");
      expect(marks.end !== undefined, "fast-forward did not play to the end");
      // cursors still fly and dock, just fast
      const roles = ["layout", "copy", "media", "style"].filter((r) =>
        trace.some((m) => m.kind === "move" && m.id === r)
      );
      roles.forEach((r) => expect(marks[`dock:${r}`] !== undefined, `${r} never docked`));
      const late = roles.filter((r) => marks[`dock:${r}`] > hold);
      info.push(`docked after the scroll: ${late.join(", ") || "none"}`);
      expect(late.length > 0, "no cursor docked during the fast-forward");
      const fast = trace.filter((m) => m.kind === "move" && m.t > hold);
      expect(fast.length > 0, "no cursor flew during the fast-forward");
    } else {
      expect(marks.cap !== undefined, "the cap did not fire");
      expect(marks.end === undefined, "a stalled fast-forward still finished");
      expect(held >= HOLD_MS - HOLD_SLACK_MS / 2, `released after only ${Math.round(held)}ms`);
    }

    info.push(`${rec.absorbed} inputs absorbed`);
    expect(rec.absorbed >= minAbsorbed, `only ${rec.absorbed} of ${minAbsorbed}+ inputs absorbed`);
    // absorbed, never replayed: no scroll during the hold or after it ends
    const moved = samples.find((x) => x.t <= rec.gone + 500 && x.y !== 0);
    expect(!moved, `page scrolled to ${moved?.y} at +${rel(moved?.t ?? 0)}ms`);
    // released: a scroll once it is over moves the page
    info.push(`scroll after: ${rec.releasedY}px`);
    expect((rec.releasedY ?? 0) > 0, "scrolling not released after the intro");
  }
  rec.final.forEach((f) => expect(false, `final state: ${f}`));

  console.log(`${failures.length ? "FAIL" : "ok  "} - ${label}: ${info.join("; ")}`);
  failures.forEach((f) => console.log(`       ${f}`));
  return failures.length;
}

interface Scenario {
  label: string;
  width: number;
  height: number;
  ending: Ending;
  opts: PlayOptions;
  /** scroll inputs that must have been absorbed */
  absorbed?: number;
}

const DESKTOP = { width: 1440, height: 900 };
const SCENARIOS: Scenario[] = [
  {
    label: "wheel at 0.2s",
    ...DESKTOP,
    ending: "fast-forward",
    opts: { release: true, act: async (a) => (await a.at(200), await a.wheel()) },
  },
  {
    label: "wheel at 3s",
    ...DESKTOP,
    ending: "fast-forward",
    opts: { release: true, act: async (a) => (await a.at(3000), await a.wheel()) },
  },
  {
    label: "more scrolling during the fast-forward",
    ...DESKTOP,
    ending: "fast-forward",
    // the first wheel plus all six below land inside the hold
    absorbed: 7,
    opts: {
      release: true,
      act: async (a) => {
        await a.at(200);
        await a.wheel();
        for (const [ms, key] of [
          [300, ""],
          [400, "ArrowDown"],
          [500, ""],
          [600, "PageDown"],
          [700, " "],
          [800, ""],
        ] as const) {
          await a.at(ms);
          if (key) await a.page.keyboard.press(key);
          else await a.wheel(800);
        }
      },
    },
  },
  {
    label: "arrow key at 1s",
    ...DESKTOP,
    ending: "fast-forward",
    opts: { release: true, act: async (a) => (await a.at(1000), await a.page.keyboard.press("ArrowDown")) },
  },
  {
    label: "touch scroll at 0.2s (390, touch)",
    width: 390,
    height: 844,
    ending: "fast-forward",
    opts: { touch: true, release: true, act: async (a) => (await a.at(200), await a.swipe()) },
  },
  {
    label: "cap: fast-forward stalled, wheel at 0.5s",
    ...DESKTOP,
    ending: "cap",
    opts: {
      release: true,
      act: async (a) => {
        // the intro never hears about the scroll: only the boot script's cap can end it
        await a.page.evaluate(() => (window.__introFastForward = () => {}));
        await a.at(500);
        await a.wheel();
        await a.at(1100);
        await a.wheel(800);
      },
    },
  },
  {
    label: "Escape at 1s",
    ...DESKTOP,
    ending: "escape",
    opts: { act: async (a) => (await a.at(1000), await a.page.keyboard.press("Escape")) },
  },
];

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  let failed = 0;
  try {
    for (const { width, height } of VIEWPORTS) {
      const rec = await record(browser, url, width, height);
      failed += check(rec, `full run ${width}x${height}`, width, height);
    }
    for (const sc of SCENARIOS) {
      const rec = await record(browser, url, sc.width, sc.height, sc.opts);
      failed += checkInput(rec, sc.label, sc.ending, sc.absorbed);
    }
  } finally {
    await browser.close();
    proc?.kill();
  }
  if (failed) {
    console.log(`\n${failed} intro check(s) failed`);
    process.exit(1);
  }
  console.log("\nintro checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

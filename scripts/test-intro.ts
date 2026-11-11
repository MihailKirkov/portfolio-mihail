import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser } from "playwright";

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
// Needs a production build: npm run build && npm run test:intro
// INTRO_URL=http://localhost:3000/ uses a server that is already running.

const BUDGET_MS = 6500;
const MIN_FLIGHT_MS = 450;
const MAX_GLIDE_PX_S = 2000;
const MAX_STEP_PX = 60; // per 60Hz frame
const MIN_CHAR_MS = 20;
const HEADLINE_GREY_MS = 1000;
const DOCK_GAP_MS = 150;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

interface Sample {
  t: number;
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

async function record(browser: Browser, url: string, width: number, height: number): Promise<Recording> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  // tsx compiles with keepNames, which wraps functions passed to the page in a
  // __name() helper that only exists in Node
  await page.addInitScript("globalThis.__name = (f) => f;");
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__cursorTrace = [];
    const samples: unknown[] = [];
    const styled: Record<string, number> = {};
    w.__introRec = { samples, styled };
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
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-intro"), null, {
    timeout: 15000,
  });
  await page.waitForTimeout(300);
  const rec = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const { samples, styled } = w.__introRec as { samples: unknown[]; styled: Record<string, number> };
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
  await page.close();
  return rec as Recording;
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
  // ... and keeps moving through each one (no stalls mid-line)
  copyGlides.forEach((g) => {
    const inner = running.filter((s) => s.t > g.t + 50 && s.t < g.t + (g.ms ?? 0) - 50);
    for (let i = 1; i < inner.length; i++) {
      const p = inner[i - 1].cursors.copy;
      const q = inner[i].cursors.copy;
      if (inner[i].t - inner[i - 1].t > 50) continue;
      if (p && q && Math.hypot(q.x - p.x, q.y - p.y) < 0.05) {
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

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  let failed = 0;
  try {
    for (const { width, height } of VIEWPORTS) {
      const rec = await record(browser, url, width, height);
      failed += check(rec, `${width}x${height}`, width, height);
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

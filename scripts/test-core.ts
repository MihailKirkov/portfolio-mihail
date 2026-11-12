import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

// Browser checks for the core's travel between the hero and the docked
// command bar (components/core/core.tsx), in real Chrome at 1440x900 with the
// intro skipped. In every case the core must end exactly in its slot, at the
// slot's size, with the canvas rendered at that size:
//   - docked, a reply ("Why should we hire you?") grows the bar and then
//     leaves it taller than before: the core follows the slot back to idle
//   - five quick scroll-downs and -ups ending at the top, then ending at the
//     bottom: the core settles home / in the dock
//   - a reversal mid-flight: scroll down, then up while the core is still on
//     its way; it turns round without a jump and lands home
// Needs a production build: npm run build && npm run test:core
// INTRO_URL=http://localhost:3000/ uses a server that is already running.

const TOLERANCE_PX = 1;
const SETTLE_TIMEOUT_MS = 4000;
/** a hero-to-dock trip is about 800px; a true jump covers most of it in one frame */
const MAX_STEP_FRACTION = 0.3;

interface Snapshot {
  mode: "home" | "flying" | "docked";
  /** how the last retarget travelled */
  travel: string;
  core: { x: number; y: number; w: number; h: number };
  home: { x: number; y: number; w: number; h: number };
  slot: { x: number; y: number; w: number; h: number };
  canvas: { w: number; h: number } | null;
  dpr: number;
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
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

function snapshot(): Snapshot {
  const rect = (el: Element | null) => {
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 };
  };
  const stack = document.querySelector<HTMLElement>(".core-stack");
  const canvas = stack?.querySelector("canvas");
  return {
    mode: stack && "flying" in stack.dataset ? "flying" : stack && "docked" in stack.dataset ? "docked" : "home",
    travel: stack?.dataset.travel ?? "",
    core: rect(stack),
    home: rect(document.querySelector(".hero-core")),
    slot: rect(document.querySelector("[data-core-slot]")),
    canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
    dpr: window.devicePixelRatio,
  };
}

async function open(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript("globalThis.__name = (f) => f;");
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("mk:intro-played", "1");
    } catch {}
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  // the live core, so the canvas size is checked too
  await page.waitForSelector("[data-core-ready]", { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.mouse.move(720, 450);
  return page;
}

/**
 * scroll at a human pace: about 2000px/s, below the crossfade threshold, in
 * instant steps like wheel input (the page's CSS scroll-behavior is smooth,
 * which would turn these into one rushed glide). A new call takes over from
 * one still running (a reversal).
 */
function scrollSlowly(page: Page, to: number) {
  return page.evaluate(async (to) => {
    const w = window as unknown as { __scrollGen?: number };
    const gen = (w.__scrollGen = (w.__scrollGen ?? 0) + 1);
    const from = window.scrollY;
    const steps = Math.max(1, Math.round(Math.abs(to - from) / 60));
    for (let i = 1; i <= steps; i++) {
      if (w.__scrollGen !== gen) return;
      window.scrollTo({ top: from + ((to - from) * i) / steps, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 30));
    }
  }, to);
}

async function settled(page: Page): Promise<Snapshot> {
  await page.waitForFunction(
    () => {
      const s = document.querySelector<HTMLElement>(".core-stack");
      return !!s && !("flying" in s.dataset) && s.style.opacity === "";
    },
    null,
    { timeout: SETTLE_TIMEOUT_MS, polling: "raf" }
  );
  // a settle lands, then may re-sync once more (the bar's slide-in): let it
  await page.waitForTimeout(800);
  return page.evaluate(snapshot);
}

function expectIn(s: Snapshot, where: "home" | "slot", failures: string[], label: string) {
  const box = where === "home" ? s.home : s.slot;
  const off = Math.max(Math.abs(s.core.x - box.x), Math.abs(s.core.y - box.y), Math.abs(s.core.w - box.w));
  if (off > TOLERANCE_PX) {
    failures.push(
      `${label}: core at (${s.core.x.toFixed(1)},${s.core.y.toFixed(1)}) ${s.core.w.toFixed(1)}px, ${where} at (${box.x.toFixed(1)},${box.y.toFixed(1)}) ${box.w.toFixed(1)}px`
    );
  }
  const wantMode = where === "home" ? "home" : "docked";
  if (s.mode !== wantMode) failures.push(`${label}: mode ${s.mode}, expected ${wantMode}`);
  if (s.canvas) {
    const want = Math.round(box.w * s.dpr);
    if (Math.abs(s.canvas.w - want) > 1 || Math.abs(s.canvas.h - want) > 1) {
      failures.push(`${label}: canvas ${s.canvas.w}x${s.canvas.h}, expected ${want}x${want}`);
    }
  } else {
    failures.push(`${label}: no canvas`);
  }
}

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  const failures: string[] = [];
  const report = (label: string, info: string, before: number) => {
    const bad = failures.length - before;
    console.log(`${bad ? "FAIL" : "ok  "} - ${label}: ${info}`);
    failures.slice(before).forEach((f) => console.log(`       ${f}`));
  };

  try {
    // 1. dock position after a reply returns to idle
    {
      const n = failures.length;
      const page = await open(browser, url);
      await scrollSlowly(page, 2000);
      const dockedBefore = await settled(page);
      expectIn(dockedBefore, "slot", failures, "docked before the reply");
      if (dockedBefore.travel !== "fly") failures.push(`a slow scroll ${dockedBefore.travel || "did not travel"}, expected a flight`);
      await page.click(".dock .chip:has-text('Why should we hire you?')");
      await page.waitForTimeout(800);
      const during = await page.evaluate(snapshot);
      await page.waitForFunction(
        () =>
          document.querySelector(".dock .cmd-status")?.textContent === "idle" &&
          !document.querySelector(".dock .cmd-caret"),
        null,
        { timeout: 30000 }
      );
      const after = await settled(page);
      expectIn(after, "slot", failures, "idle after the reply");
      report(
        "dock position after a reply",
        `slot moved ${Math.round(dockedBefore.slot.y)} -> ${Math.round(during.slot.y)} -> ${Math.round(after.slot.y)}; core ended at ${Math.round(after.core.y)}`,
        n
      );
      await page.context().close();
    }

    // 2. five quick round trips, ending home and ending docked
    for (const end of ["home", "slot"] as const) {
      const n = failures.length;
      const page = await open(browser, url);
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
        await page.waitForTimeout(120);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(120);
      }
      if (end === "slot") await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
      const s = await settled(page);
      expectIn(s, end, failures, `ending ${end}`);
      report(
        `five quick round trips ending ${end === "home" ? "at the top" : "docked"}`,
        `core ${Math.round(s.core.w)}px at (${Math.round(s.core.x)},${Math.round(s.core.y)}), canvas ${s.canvas?.w}`,
        n
      );
      await page.context().close();
    }

    // 3. reversing mid-flight
    {
      const n = failures.length;
      const page = await open(browser, url);
      await page.evaluate(() => {
        const w = window as unknown as { __trace: { t: number; x: number; y: number; w: number; cw: number }[] };
        w.__trace = [];
        const tick = (t: number) => {
          const s = document.querySelector<HTMLElement>(".core-stack");
          const r = s?.getBoundingClientRect();
          const c = s?.querySelector("canvas");
          if (r) w.__trace.push({ t, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, cw: c?.width ?? 0 });
          if (performance.now() < 20000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const trip = await page.evaluate(() => {
        const a = document.querySelector(".hero-core")!.getBoundingClientRect();
        return a.width;
      });
      const down = scrollSlowly(page, 1400);
      // mid-flight: the core has left the hero and is well short of the slot
      // (a re-sync after landing also flies, at the slot's size: not that)
      await page.waitForFunction(
        () => {
          const s = document.querySelector<HTMLElement>(".core-stack");
          const w = s?.getBoundingClientRect().width ?? 0;
          return !!s && "flying" in s.dataset && w < 250 && w > 60;
        },
        null,
        { timeout: 3000, polling: "raf" }
      );
      const atReversal = await page.evaluate(snapshot);
      await scrollSlowly(page, 0);
      await down;
      const s = await settled(page);
      expectIn(s, "home", failures, "after reversing");
      if (s.travel !== "fly") failures.push(`the reversal ${s.travel || "did not travel"}, expected a flight`);
      const trace = await page.evaluate(
        () => (window as unknown as { __trace: { t: number; x: number; y: number; w: number; cw: number }[] }).__trace
      );
      // continuity: no frame moves the core more than a fraction of the trip
      const dist = Math.hypot(atReversal.slot.x - atReversal.home.x, atReversal.slot.y - atReversal.home.y) || trip;
      let maxStep = 0;
      let sizes = new Set<number>();
      for (let i = 1; i < trace.length; i++) {
        const a = trace[i - 1];
        const b = trace[i];
        if (b.t - a.t > 50) continue;
        const step = Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(b.w - a.w);
        maxStep = Math.max(maxStep, step);
        if (a.w !== b.w) sizes.add(b.cw); // canvas sizes seen while in motion
      }
      if (maxStep > dist * MAX_STEP_FRACTION) {
        failures.push(`jumped ${Math.round(maxStep)}px in one frame (trip ${Math.round(dist)}px)`);
      }
      sizes = new Set([...sizes].filter((v) => v !== Math.round(trip)));
      if (sizes.size) failures.push(`canvas re-rendered at ${[...sizes].join(", ")}px while in flight`);
      report(
        "reversing mid-flight",
        `turned at ${Math.round(atReversal.core.w)}px, max step ${Math.round(maxStep)}px/frame, canvas ${Math.round(trip)}px throughout`,
        n
      );
      await page.context().close();
    }
  } finally {
    await browser.close();
    proc?.kill();
  }
  if (failures.length) {
    console.log(`\n${failures.length} core check(s) failed`);
    process.exit(1);
  }
  console.log("\ncore checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

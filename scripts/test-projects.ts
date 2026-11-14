import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

// Browser check for the projects depth stage (components/projects/depth-stage.tsx):
// the info panel, the rail's active entry and the front image must always
// show the same project. Real Chrome at 1440x900, intro skipped.
//   1. wheel through the whole section at a human pace and sample after every
//      step, mid-scroll: the rail's aria-current, the panel marked active (and
//      the only panel visible), the slab marked front and the stage's own
//      index must all agree
//   2. once the WebGL scene is in: step through the section and at each
//      position compare the plane the scene draws nearest (canvas data-front)
//      with the stage's index too
//      (each frame, no one-frame allowance), down and back up
//   3. jump into each chapter from the top and the bottom of the page: the
//      first frames agree too
// Also prints the WebGL gate's decision (<html data-gl>). REQUIRE_GL=1 fails
// the run when the gate does not end "on".
// Needs a production build: npm run build && npm run test:projects
// TEST_URL=https://... (or INTRO_URL) runs against a server already up, e.g.
// the Vercel preview.

const STEP_PX = 60;

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
  const given = process.env.TEST_URL ?? process.env.INTRO_URL;
  if (given) return { url: given };
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("no production build: run `npm run build` first (or set TEST_URL)");
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
  await page.waitForSelector('.depth[data-depth="on"]', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.mouse.move(720, 450);
  return page;
}

interface Sample {
  y: number;
  stage: number;
  rail: number[];
  panel: number[];
  visiblePanels: number[];
  slab: number[];
  gl: number | null;
  glOn: boolean;
}

/** one read of everything, inside a frame */
function sample(): Promise<Sample> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".depth")!;
      const idx = (sel: string, test: (el: HTMLElement) => boolean) =>
        [...root.querySelectorAll<HTMLElement>(sel)].flatMap((el, i) => (test(el) ? [i] : []));
      const canvas = root.querySelector<HTMLCanvasElement>(".depth-gl canvas");
      resolve({
        y: Math.round(scrollY),
        stage: Number(root.dataset.depthFront ?? -1),
        rail: idx("[data-chapter-link]", (a) => a.getAttribute("aria-current") === "step"),
        panel: idx("[data-depth-panel]", (p) => p.hasAttribute("data-active")),
        visiblePanels: idx("[data-depth-panel]", (p) => getComputedStyle(p).visibility !== "hidden"),
        slab: idx("[data-depth-chapter]", (s) => s.dataset.depthState === "front"),
        gl: canvas?.dataset.front !== undefined ? Number(canvas.dataset.front) : null,
        glOn: root.hasAttribute("data-depth-gl"),
      });
    })
  );
}

/** the DOM side: one index everywhere */
function domMismatch(s: Sample): string | null {
  const one = (name: string, v: number[]) =>
    v.length === 1 && v[0] === s.stage ? null : `${name} ${JSON.stringify(v)}`;
  const bad = [
    one("rail", s.rail),
    one("panel", s.panel),
    one("visible panel", s.visiblePanels),
    one("front slab", s.slab),
  ].filter(Boolean);
  return bad.length ? `y=${s.y} stage=${s.stage}: ${bad.join(", ")}` : null;
}

/** the scene's nearest drawn plane, once it is in */
function glMismatch(s: Sample): string | null {
  return s.glOn && s.gl !== null && s.gl !== s.stage
    ? `y=${s.y} stage=${s.stage}: WebGL front plane ${s.gl}`
    : null;
}

const document_end = -1;

/** wait until the page's scroll has stopped moving */
async function settle(page: Page) {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const y = await page.evaluate(() => scrollY);
    if (y === last) {
      await page.waitForTimeout(150);
      if ((await page.evaluate(() => scrollY)) === y) return;
    }
    last = y;
    await page.waitForTimeout(100);
  }
}

async function bounds(page: Page) {
  return page.evaluate(() => {
    const track = document.querySelector<HTMLElement>(".depth-track")!;
    const top = track.getBoundingClientRect().top + scrollY;
    return { from: Math.round(top - innerHeight * 0.5), to: Math.round(top + track.offsetHeight) };
  });
}

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  let failed = 0;
  const report = (name: string, bad: string[], detail: string) => {
    if (bad.length) failed++;
    console.log(`${bad.length ? "FAIL" : "ok  "} - ${name}: ${detail}`);
    bad.slice(0, 8).forEach((b) => console.log(`       ${b}`));
    if (bad.length > 8) console.log(`       ... ${bad.length - 8} more`);
  };
  try {
    const page = await open(browser, url);
    const { from, to } = await bounds(page);

    // 1. wheel through, sampling mid-scroll
    {
      await page.evaluate((y) => window.scrollTo(0, y), from);
      await page.waitForTimeout(800);
      const bad: string[] = [];
      let n = 0;
      const seen = new Set<number>();
      for (let guard = 0; guard < 2000; guard++) {
        await page.mouse.wheel(0, 100);
        const s = await page.evaluate(sample);
        n++;
        seen.add(s.stage);
        const m = domMismatch(s) ?? glMismatch(s);
        if (m) bad.push(m);
        if (s.y >= to) break;
      }
      report("wheel down, mid-scroll", bad, `${n} samples, ${seen.size} projects seen`);
    }

    // 2. the WebGL scene, if the gate let it in
    const glOn = await page
      .waitForSelector(".depth[data-depth-gl]", { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const gate = await page.evaluate(() => ({
      gl: document.documentElement.dataset.gl ?? "(unset)",
      frameMs: document.documentElement.dataset.glFrameMs ?? "-",
      cores: navigator.hardwareConcurrency,
    }));
    console.log(`     gate: data-gl=${gate.gl}, probe avg ${gate.frameMs}ms, cores ${gate.cores}`);
    if (process.env.REQUIRE_GL && (!glOn || gate.gl !== "on")) {
      report("WebGL gate", [`expected on, got ${gate.gl} (scene ${glOn ? "on" : "off"})`], "REQUIRE_GL");
    }

    for (const dir of [1, -1] as const) {
      await settle(page);
      const bad: string[] = [];
      let n = 0;
      let glChecked = 0;
      const ys: number[] = [];
      for (let y = dir > 0 ? from : to; dir > 0 ? y <= to : y >= from; y += dir * STEP_PX) ys.push(y);
      for (const y of ys) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        // two frames: the one right after the scroll, and the next
        for (let f = 0; f < 2; f++) {
          const s = await page.evaluate(sample);
          if (f === 1 && Math.abs(s.y - y) > 2) bad.push(`scroll to ${y} landed at ${s.y}`);
          n++;
          const m = domMismatch(s) ?? glMismatch(s);
          if (m) bad.push(m);
          if (s.glOn && s.gl !== null) glChecked++;
        }
      }
      report(
        `step ${dir > 0 ? "down" : "up"}${glOn ? " with WebGL" : " (CSS slabs)"}`,
        bad,
        `${ys.length} positions, ${n} frames, ${glChecked} WebGL comparisons`
      );
    }

    // 3. jump in from outside the section (nav, rail, agent): the very first
    //    frames already agree, the scene does not show where it was left
    {
      const bad: string[] = [];
      let n = 0;
      const stops = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>(".depth")!;
        const track = root.querySelector<HTMLElement>(".depth-track")!;
        const stage = root.querySelector<HTMLElement>(".depth-stage")!;
        const stuck = parseFloat(getComputedStyle(stage).top) || 0;
        const start = track.getBoundingClientRect().top + scrollY - stuck;
        const range = track.offsetHeight - stage.offsetHeight;
        const k = root.querySelectorAll("[data-depth-chapter]").length;
        return Array.from({ length: k }, (_, i) => Math.round(start + (k > 1 ? i / (k - 1) : 0) * range));
      });
      for (const [i, y] of stops.entries()) {
        for (const away of [0, document_end]) {
          await page.evaluate((a) => window.scrollTo(0, a === -1 ? document.body.scrollHeight : a), away);
          await settle(page);
          await page.evaluate((y) => window.scrollTo(0, y), y);
          for (let f = 0; f < 3; f++) {
            const s = await page.evaluate(sample);
            n++;
            const m = domMismatch(s) ?? glMismatch(s) ?? (s.stage === i ? null : `stop ${i}: stage ${s.stage}`);
            if (m) bad.push(`from ${away === -1 ? "bottom" : "top"}: ${m}`);
          }
        }
      }
      report("jump in from top and bottom", bad, `${stops.length} stops, ${n} frames`);
    }

    await page.context().close();
  } finally {
    await browser.close();
    proc?.kill();
  }
  console.log(failed ? `\n${failed} projects check(s) failed` : "\nprojects checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

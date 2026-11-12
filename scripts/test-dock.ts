import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

// Browser checks for the docked command bar on narrow viewports (320, 360
// and 390px wide, touch), with the intro skipped. Idle, mid-reply and after
// a long reply:
//   - the bar never exceeds 40% of the viewport height, and sits above the
//     safe-area bottom
//   - idle with no answer it is one compact row: no answer body
//   - with an answer the body shows on its own full-width row, the text is
//     never clamped or cut (it scrolls inside the bar instead), and "hide"
//     folds it away again
//   - the chips are reachable: they show while the input is focused
//   - the page keeps the collapsed bar's height clear: the last button in
//     the projects section, and the last link on the page, scroll fully
//     into view above the bar
// Needs a production build: npm run build && npm run test:dock
// INTRO_URL=http://localhost:3000/ uses a server that is already running.

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
];
const CAP = 0.4;
const TOLERANCE_PX = 1;

interface Bar {
  top: number;
  bottom: number;
  height: number;
  expanded: string | null;
  bodyShown: boolean;
  chipsShown: boolean;
  inputShown: boolean;
  answer: { text: string; clamp: string; overflow: number } | null;
  bodyScrolls: boolean;
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

function bar(): Bar {
  const shown = (el: Element | null) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  };
  const dock = document.querySelector<HTMLElement>(".dock")!;
  const inner = dock.querySelector<HTMLElement>(".dock-inner")!;
  const r = inner.getBoundingClientRect();
  const body = dock.querySelector<HTMLElement>(".dock-body");
  const p = dock.querySelector<HTMLElement>(".dock-answer");
  const bodyShown = shown(body);
  return {
    top: r.top,
    bottom: r.bottom,
    height: r.height,
    expanded: dock.getAttribute("data-expanded"),
    bodyShown,
    chipsShown: shown(dock.querySelector(".dock-chips")),
    inputShown: shown(dock.querySelector("input")),
    answer:
      bodyShown && p
        ? {
            text: p.textContent ?? "",
            clamp: getComputedStyle(p).webkitLineClamp,
            overflow: p.scrollHeight - p.clientHeight,
          }
        : null,
    bodyScrolls: !!body && body.scrollHeight > body.clientHeight + 1,
  };
}

async function open(browser: Browser, url: string, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript("globalThis.__name = (f) => f;");
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("mk:intro-played", "1");
    } catch {}
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
  await page.waitForSelector('.dock[data-docked="true"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  return page;
}

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  const failures: string[] = [];
  let before = 0;
  const report = (label: string, info: string) => {
    const bad = failures.length - before;
    console.log(`${bad ? "FAIL" : "ok  "} - ${label}: ${info}`);
    failures.slice(before).forEach((f) => console.log(`       ${f}`));
    before = failures.length;
  };
  const expect = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg);
  };

  try {
    for (const { width, height } of VIEWPORTS) {
      const page = await open(browser, url, width, height);
      const cap = height * CAP;
      const sized = (b: Bar, when: string) => {
        expect(b.height <= cap + TOLERANCE_PX, `${when}: bar ${Math.round(b.height)}px, cap ${Math.round(cap)}px`);
        expect(b.bottom <= height + TOLERANCE_PX, `${when}: bar bottom ${Math.round(b.bottom)}px past the viewport`);
        expect(b.inputShown, `${when}: input not shown`);
      };
      const readable = (b: Bar, when: string) => {
        expect(b.expanded === "true" && b.bodyShown, `${when}: answer body not shown`);
        if (!b.answer) return;
        expect(b.answer.clamp === "none", `${when}: answer line-clamped (${b.answer.clamp})`);
        expect(b.answer.overflow <= 1, `${when}: answer text cut by ${b.answer.overflow}px`);
      };

      // idle: one compact row
      const idle = await page.evaluate(bar);
      sized(idle, "idle");
      expect(!idle.bodyShown, "idle: answer body shown with no answer");
      expect(!idle.chipsShown, "idle: chips shown before the input is focused");

      // the page keeps the bar's height clear below content
      const clear = async (selector: string, what: string) => {
        const r = await page.evaluate((sel) => {
          const els = document.querySelectorAll<HTMLElement>(sel);
          const el = els[els.length - 1];
          if (!el) return null;
          el.scrollIntoView({ block: "end", behavior: "instant" });
          const b = el.getBoundingClientRect();
          const bar = document.querySelector(".dock-inner")!.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom, barTop: bar.top, text: el.textContent?.trim() ?? "" };
        }, selector);
        expect(!!r, `${what}: not found`);
        if (!r) return;
        expect(
          r.bottom <= r.barTop + TOLERANCE_PX && r.top >= 0,
          `${what} "${r.text}" at ${Math.round(r.top)}-${Math.round(r.bottom)}px, bar top ${Math.round(r.barTop)}px`
        );
      };
      await clear("#projects .btn, #projects a.btn", "last button in projects");
      await clear("#contact a", "last link on the page");
      await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
      await page.waitForTimeout(300);

      // the chips: reachable from the input
      await page.focus(".dock input");
      await page.waitForTimeout(100);
      const focused = await page.evaluate(bar);
      expect(focused.chipsShown, "chips not shown while the input is focused");
      sized(focused, "input focused");

      // a reply: the longest canned one
      await page.click(".dock .chip:has-text('Tell me about a project')");
      await page.waitForTimeout(600);
      const mid = await page.evaluate(bar);
      sized(mid, "mid-reply");
      readable(mid, "mid-reply");
      await page.waitForFunction(
        () =>
          document.querySelector(".dock .cmd-status")?.textContent === "idle" &&
          !document.querySelector(".dock .cmd-caret"),
        null,
        { timeout: 30000 }
      );
      // the reply opened a project gallery (a modal dialog): close it first
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const after = await page.evaluate(bar);
      sized(after, "after the reply");
      readable(after, "after the reply");
      expect((after.answer?.text.length ?? 0) > 150, `after the reply: answer is ${after.answer?.text.length ?? 0} chars`);
      expect(after.chipsShown, "after the reply: chips not shown");

      // fold away, and back
      await page.click(".dock .dock-toggle");
      await page.waitForTimeout(150);
      const folded = await page.evaluate(bar);
      sized(folded, "folded");
      expect(!folded.bodyShown, "folded: answer body still shown");
      await page.click(".dock .dock-toggle");
      await page.waitForTimeout(150);
      const again = await page.evaluate(bar);
      readable(again, "unfolded");

      report(
        `${width}x${height}`,
        `idle ${Math.round(idle.height)}px, reply ${Math.round(after.height)}px (cap ${Math.round(cap)}px)${after.bodyScrolls ? ", answer scrolls" : ""}, folded ${Math.round(folded.height)}px`
      );
      await page.context().close();
    }
  } finally {
    await browser.close();
    proc?.kill();
  }
  if (failures.length) {
    console.log(`\n${failures.length} dock check(s) failed`);
    process.exit(1);
  }
  console.log("\ndock checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

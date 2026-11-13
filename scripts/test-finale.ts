import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

// Browser checks for the contact finale (components/site/finale-orbit.tsx,
// V3-PLAN Round 2 part 3), in real Chrome at 1440x900 with the intro skipped:
//   - scrolling into contact by wheel: the project images and skill markers
//     are in the DOM and visible, the dock is hidden and lets clicks through
//     to the CV / GitHub / LinkedIn buttons, and the old hero status line is
//     not in the section
//   - scrolling back up out of contact: the dock returns
//   - the same via the nav link (the agent's scroll path)
// Needs a production build: npm run build && npm run test:finale
// INTRO_URL=http://localhost:3000/ uses a server that is already running.

const SETTLE_MS = 2500;

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
  await page.waitForSelector("[data-core-ready]", { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.mouse.move(720, 450);
  return page;
}

interface FinaleState {
  inContact: boolean;
  imgs: number;
  imgsVisible: number;
  skills: number;
  skillsVisible: number;
  status: number;
  dockHidden: boolean;
  dockShown: boolean;
  buttonsClickable: string[];
  buttonsBlocked: string[];
}

function state(): FinaleState {
  const c = document.getElementById("contact")!;
  const cr = c.getBoundingClientRect();
  // skill markers are faint by design (0.5); images settle at 0.85
  const visible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < innerHeight &&
      r.right > 0 &&
      r.left < innerWidth &&
      Number(getComputedStyle(el).opacity) >= 0.3
    );
  };
  const imgs = [...c.querySelectorAll<HTMLElement>(".finale-img")];
  const skills = [...c.querySelectorAll<HTMLElement>(".finale-skill")];
  const dock = document.querySelector<HTMLElement>(".dock");
  // the .dock wrapper never takes pointer events itself (its bar does), so
  // "hidden" is opacity plus the finale flag; the buttons are hit-tested below
  const ds = dock ? getComputedStyle(dock) : null;
  const inner = dock?.querySelector<HTMLElement>(".dock-inner");
  const clickable: string[] = [];
  const blocked: string[] = [];
  c.querySelectorAll<HTMLElement>(".contact-links .btn").forEach((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    (b.contains(hit) ? clickable : blocked).push(b.textContent?.trim() ?? "?");
  });
  return {
    // the section fills the viewport below the top bar
    inContact: cr.top < 120 && cr.bottom > innerHeight - 40,
    imgs: imgs.length,
    imgsVisible: imgs.filter(visible).length,
    skills: skills.length,
    skillsVisible: skills.filter(visible).length,
    status: c.querySelectorAll(".hero-status").length,
    dockHidden: !!ds && Number(ds.opacity) < 0.05 && dock?.dataset.finale === "true",
    dockShown:
      !!ds &&
      Number(ds.opacity) > 0.95 &&
      !dock?.dataset.finale &&
      !!inner &&
      getComputedStyle(inner).pointerEvents !== "none",
    buttonsClickable: clickable,
    buttonsBlocked: blocked,
  };
}

/** wheel down at a human pace until contact fills the viewport */
async function wheelIntoContact(page: Page) {
  // jump to just above contact, then the last stretch by wheel
  await page.evaluate(() => {
    const c = document.getElementById("contact")!;
    window.scrollTo(0, c.getBoundingClientRect().top + scrollY - innerHeight * 1.5);
  });
  await page.waitForTimeout(600);
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(SETTLE_MS);
}

async function wheelUp(page: Page, px: number) {
  for (let i = 0; i < Math.ceil(px / 120); i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(SETTLE_MS);
}

function checkIn(s: FinaleState): string[] {
  const bad: string[] = [];
  if (!s.inContact) bad.push("contact does not fill the viewport");
  if (s.imgs === 0) bad.push("no project images in the DOM");
  else if (s.imgsVisible === 0) bad.push(`${s.imgs} project images, none visible`);
  if (s.skills === 0) bad.push("no skill markers in the DOM");
  else if (s.skillsVisible === 0) bad.push(`${s.skills} skill markers, none visible`);
  if (s.status) bad.push("hero status line inside contact");
  if (!s.dockHidden) bad.push("dock not hidden");
  if (s.buttonsBlocked.length) bad.push(`buttons covered: ${s.buttonsBlocked.join(", ")}`);
  if (s.buttonsClickable.length !== 3) bad.push(`${s.buttonsClickable.length}/3 buttons clickable`);
  return bad;
}

const fmt = (s: FinaleState) =>
  `images ${s.imgsVisible}/${s.imgs} visible, skills ${s.skillsVisible}/${s.skills} visible, dock ${
    s.dockHidden ? "hidden" : s.dockShown ? "shown" : "between"
  }, buttons ${s.buttonsClickable.length}/3 clickable`;

async function main() {
  const { url, proc } = await startServer();
  const browser = await launch();
  let failed = 0;
  const report = (name: string, bad: string[], detail: string) => {
    if (bad.length) failed++;
    console.log(`${bad.length ? "FAIL" : "ok  "} - ${name}: ${detail}`);
    if (bad.length) console.log(`       ${bad.join("; ")}`);
  };
  try {
    // 1. wheel into contact, then back up
    {
      const page = await open(browser, url);
      await wheelIntoContact(page);
      const s = await page.evaluate(state);
      report("wheel into contact", checkIn(s), fmt(s));

      await wheelUp(page, 1800);
      const up = await page.evaluate(state);
      report(
        "wheel back up out of contact",
        up.dockShown ? [] : ["dock did not return"],
        fmt(up)
      );
      await page.context().close();
    }
    // 2. the nav link (the agent's scroll path)
    {
      const page = await open(browser, url);
      await page.click('[data-agent-id="nav:contact"]');
      await page.waitForTimeout(SETTLE_MS + 2000);
      const s = await page.evaluate(state);
      report("nav link to contact", checkIn(s), fmt(s));
      await page.context().close();
    }
  } finally {
    await browser.close();
    proc?.kill();
  }
  console.log(failed ? `\n${failed} finale check(s) failed` : "\nfinale checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import assert from "node:assert/strict";
import type { CursorDriver, Point, Step } from "@/lib/agent/choreo";
import type { ToolLogEntry } from "@/lib/agent/runner";

// Drives the cursor engine and the action runner against a fake window and a
// fake cursor driver: scroll pauses, resume recomputes, long scrolls and
// clicks/keys cancel, and "Show me" replays what a cancel left unrun.
// No browser. Real timers, so it takes a few seconds. Run: npm run test:choreo

type Listener = (e: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

const fakeWindow = {
  innerWidth: 1200,
  innerHeight: 800,
  scrollY: 0,
  addEventListener(type: string, fn: Listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener(type: string, fn: Listener) {
    listeners.get(type)?.delete(fn);
  },
  matchMedia: () => ({ matches: false }),
  scrollTo() {},
};

/** a trusted visitor event, as the engine's window listeners would see it */
function fire(type: string, extra: Record<string, unknown> = {}) {
  [...(listeners.get(type) ?? [])].forEach((fn) => fn({ type, isTrusted: true, ...extra }));
}

/** elements the fake document can find, by agent id */
const rendered = new Map<string, unknown>();

Object.assign(globalThis, {
  window: fakeWindow,
  document: {
    querySelectorAll(selector: string) {
      const id = /data-agent-id="(.*)"\]$/.exec(selector)?.[1];
      const el = id ? rendered.get(id) : undefined;
      return el ? [el] : [];
    },
  },
  CSS: { escape: (s: string) => s },
  requestAnimationFrame: (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16),
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** an element whose viewport position the test can move, like a scroll would */
function fakeElement(top: number) {
  const el = {
    top,
    offsetWidth: 400,
    querySelector: () => null,
    setAttribute() {},
    removeAttribute() {},
    getBoundingClientRect() {
      return { left: 100, top: el.top, width: 400, height: 40, right: 500, bottom: el.top + 40 };
    },
  };
  return el;
}

async function main() {
  const { choreo, RESUME_AFTER_MS, MAX_PAUSE_MS } = await import("@/lib/agent/choreo");
  const { runActions, remainingCalls, replayRemaining } = await import("@/lib/agent/runner");

  // records every flight; a flight takes its full duration unless aborted
  const moves: { cursor: string; to: Point; ms: number; straight: boolean; aborted: boolean }[] = [];
  let clicks = 0;
  const merges: { cursors: string[]; into: string; at: Point }[] = [];
  const driver: CursorDriver = {
    move(cursor, to, ms, signal, opts) {
      const move = { cursor, to, ms, straight: !!opts?.straight, aborted: false };
      moves.push(move);
      return new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          move.aborted = true;
          resolve();
        });
      });
    },
    async click() {
      clicks++;
    },
    press() {},
    async merge(cursors, into, at) {
      merges.push({ cursors, into, at });
    },
    hideAll() {},
  };
  choreo.attach(driver);

  let passed = 0;
  async function test(name: string, fn: () => Promise<void>) {
    moves.length = 0;
    clicks = 0;
    await fn();
    assert.equal(choreo.busy, false, `${name}: engine left busy`);
    passed++;
    console.log(`ok - ${name}`);
  }

  /** enqueue and track the outcome without awaiting it */
  function start(steps: Step[]) {
    const state: { result: boolean | null; done: Promise<boolean> } = {
      result: null,
      done: choreo.enqueue(steps),
    };
    void state.done.then((r) => (state.result = r));
    return state;
  }

  await test("scroll pauses the queue instead of cancelling it", async () => {
    const el = fakeElement(300);
    let ran = 0;
    const run = start([
      { kind: "moveTo", target: el as unknown as HTMLElement },
      { kind: "run", fn: () => void ran++ },
    ]);
    await sleep(100);
    fire("wheel");
    assert.equal(moves.length, 1);
    assert.equal(moves[0].aborted, true, "the flight in progress is stopped");
    await sleep(RESUME_AFTER_MS - 150);
    assert.equal(run.result, null, "not cancelled");
    assert.equal(ran, 0, "nothing runs while paused");
    assert.equal(moves.length, 1, "no new flight while paused");
    assert.equal(choreo.busy, true);
    assert.equal(await run.done, true, "completes after the pause");
    assert.equal(ran, 1);
  });

  await test("resume waits for the last scroll event and re-aims at the moved target", async () => {
    const el = fakeElement(300);
    const run = start([{ kind: "moveTo", target: el as unknown as HTMLElement }]);
    await sleep(100);
    const firstAim = moves[0].to;
    fire("wheel");
    await sleep(300);
    fire("touchmove");
    el.top = 500; // the visitor scrolled: same element, new place in the viewport
    await sleep(300);
    fire("scroll"); // momentum after the gesture still counts while paused
    const lastEvent = performance.now();
    await sleep(RESUME_AFTER_MS - 150);
    assert.equal(moves.length, 1, "each scroll event pushes the resume back");
    assert.equal(await run.done, true);
    assert.ok(performance.now() - lastEvent >= RESUME_AFTER_MS - 20, "resumed too early");
    assert.equal(moves.length, 2, "the interrupted move is flown again");
    assert.equal(moves[1].aborted, false);
    assert.equal(moves[1].to.y - firstAim.y, 200, "path recomputed from the current viewport");
  });

  await test("a target scrolled out of view stops the queue instead of scrolling back", async () => {
    const el = fakeElement(300);
    let ran = 0;
    const run = start([
      { kind: "moveTo", target: el as unknown as HTMLElement },
      { kind: "run", fn: () => void ran++ },
    ]);
    const queued = choreo.enqueue([{ kind: "run", fn: () => void ran++ }]);
    await sleep(100);
    fire("wheel");
    el.top = -400; // scrolled off the top of the viewport
    const lastEvent = performance.now();
    assert.equal(await run.done, false, "stopped, not resumed");
    assert.equal(await queued, false, "the rest of the queue is dropped");
    const took = performance.now() - lastEvent;
    assert.ok(took >= RESUME_AFTER_MS - 20 && took < RESUME_AFTER_MS + 300, `stopped after ${took}ms`);
    assert.equal(moves.length, 1, "no second flight, so no scroll back to the target");
    assert.equal(ran, 0);
  });

  await test("an off-screen stop leaves the actions for Show me", async () => {
    const stackAi = fakeElement(300);
    rendered.set("stack:ai", stackAi);
    let log: ToolLogEntry[] = [];
    const done = runActions(
      [{ name: "highlight", params: { target: "stack:ai" } }, { name: "offer_cv" }],
      (next) => (log = next)
    );
    await sleep(100); // cursor is flying to stack:ai
    fire("wheel");
    stackAi.top = 2000; // scrolled below the viewport
    assert.equal(await done, false);
    assert.deepEqual(log.map((e) => e.status), ["cancelled", "cancelled"]);
    assert.equal(remainingCalls(log).length, 2, "both offered by Show me");

    stackAi.top = 300;
    assert.equal(await replayRemaining(log, (next) => (log = next)), true);
    assert.deepEqual(log.map((e) => e.status), ["done", "done"]);
    rendered.delete("stack:ai");
  });

  await test("a scroll event outside a pause is ignored (the agent's own scrolling)", async () => {
    const el = fakeElement(300);
    const run = start([{ kind: "moveTo", target: el as unknown as HTMLElement }]);
    await sleep(100);
    fire("scroll");
    assert.equal(moves[0].aborted, false);
    assert.equal(await run.done, true);
    assert.equal(moves.length, 1);
  });

  await test("scrolling past the limit is a cancel", async () => {
    let ran = 0;
    const run = start([
      { kind: "wait", ms: 300 },
      { kind: "run", fn: () => void ran++ },
    ]);
    const queued = choreo.enqueue([{ kind: "run", fn: () => void ran++ }]);
    const started = performance.now();
    while (run.result === null && performance.now() - started < MAX_PAUSE_MS + 1500) {
      fire("wheel");
      await sleep(200);
    }
    const took = performance.now() - started;
    assert.equal(run.result, false, "cancelled");
    assert.equal(await queued, false, "queued batches are dropped too");
    assert.ok(took >= MAX_PAUSE_MS - 50 && took < MAX_PAUSE_MS + 500, `cancelled after ${took}ms`);
    assert.equal(ran, 0);
  });

  await test("clicks and key presses cancel immediately, also during a pause", async () => {
    for (const [type, extra] of [
      ["pointerdown", { pointerType: "mouse" }],
      ["keydown", {}],
      ["click", {}],
    ] as const) {
      const run = start([{ kind: "wait", ms: 400 }]);
      await sleep(50);
      fire(type, extra);
      assert.equal(await run.done, false, `${type} cancels`);
    }

    const paused = start([{ kind: "wait", ms: 400 }]);
    await sleep(50);
    fire("wheel");
    await sleep(100);
    fire("keydown");
    assert.equal(await paused.done, false, "a key press during a pause cancels");
  });

  await test("a touch scroll pauses; only a completed tap cancels", async () => {
    const run = start([{ kind: "wait", ms: 300 }]);
    await sleep(50);
    fire("pointerdown", { pointerType: "touch" });
    fire("touchmove");
    await sleep(100);
    assert.equal(run.result, null, "finger down + drag does not cancel");
    assert.equal(await run.done, true, "and the queue resumes");

    const tapped = start([{ kind: "wait", ms: 300 }]);
    await sleep(50);
    fire("pointerdown", { pointerType: "touch" });
    fire("click");
    assert.equal(await tapped.done, false, "a tap cancels");
  });

  await test("a paused action is retried and logged done, not cancelled", async () => {
    let log: ToolLogEntry[] = [];
    const done = runActions(
      [
        { name: "scroll_to", params: { section: "stack" } },
        { name: "offer_cv" },
      ],
      (next) => (log = next)
    );
    await sleep(100); // first action done, in its pause before the next one
    fire("wheel");
    await sleep(200);
    assert.deepEqual(log.map((e) => e.status), ["done", "queued"]);
    assert.equal(await done, true);
    assert.deepEqual(log.map((e) => e.status), ["done", "done"]);
  });

  await test("Show me replays only the actions a cancel left unrun", async () => {
    let log: ToolLogEntry[] = [];
    const calls = [
      { name: "scroll_to", params: { section: "stack" } },
      { name: "highlight", params: { target: "stack:ai" } },
      { name: "no_such_action" },
      { name: "offer_cv" },
    ];
    const done = runActions(calls, (next) => (log = next));
    await sleep(100);
    fire("keydown");
    assert.equal(await done, false);
    assert.deepEqual(log.map((e) => e.status), ["done", "cancelled", "rejected", "cancelled"]);
    assert.deepEqual(remainingCalls(log), [calls[1], calls[3]]);

    const clicksBefore = clicks;
    assert.equal(await replayRemaining(log, (next) => (log = next)), true);
    assert.equal(clicks - clicksBefore, 2, "exactly the two remaining actions run");
    assert.deepEqual(
      log.map((e) => [e.call.name, e.status]),
      [
        ["scroll_to", "done"],
        ["no_such_action", "rejected"],
        ["highlight", "done"],
        ["offer_cv", "done"],
      ]
    );
    assert.deepEqual(remainingCalls(log), [], "nothing left to offer");
  });

  // ---- boot intro options --------------------------------------------------

  await test("intro: a no-scroll step skips an off-screen target instead of scrolling", async () => {
    // a fake element has no scrollIntoView, so any attempt to scroll would throw
    const below = fakeElement(2000);
    let ran = 0;
    const done = await choreo.enqueue([
      { kind: "moveTo", cursor: "media", target: below as unknown as HTMLElement, scroll: false },
      { kind: "run", fn: () => void ran++ },
    ]);
    assert.equal(done, true);
    assert.equal(moves.length, 0, "no flight to an off-screen target");
    assert.equal(ran, 1, "the effect after it still runs");
  });

  await test("intro: custom aim and duration; a move to where the cursor is is free", async () => {
    const el = fakeElement(300);
    const corner = (r: DOMRect) => ({ x: r.left, y: r.top });
    const target = el as unknown as HTMLElement;
    assert.equal(
      await choreo.enqueue([
        { kind: "moveTo", cursor: "layout", target, scroll: false, aim: corner, ms: 123 },
        { kind: "moveTo", cursor: "layout", target, scroll: false, aim: corner },
      ]),
      true
    );
    assert.equal(moves.length, 1, "second move is a no-op");
    assert.deepEqual(moves[0].to, { x: 100, y: 300 });
    assert.equal(moves[0].ms, 123);
    assert.equal(moves[0].cursor, "layout");
  });

  await test("intro: a drag's pressed leg is straight and timed; parallel tracks fly separate cursors", async () => {
    const a = fakeElement(100) as unknown as HTMLElement;
    const b = fakeElement(400) as unknown as HTMLElement;
    assert.equal(
      await choreo.enqueue([
        {
          kind: "parallel",
          tracks: [
            [{ kind: "drag", cursor: "layout", from: a, to: b, ms: 200, scroll: false }],
            [{ kind: "moveTo", cursor: "copy", target: b, scroll: false }],
          ],
        },
      ]),
      true
    );
    const layout = moves.filter((m) => m.cursor === "layout");
    assert.equal(layout.length, 2);
    assert.equal(layout[0].straight, false, "the approach is a normal curved flight");
    assert.equal(layout[1].straight, true);
    assert.equal(layout[1].ms, 200);
    assert.equal(moves.filter((m) => m.cursor === "copy").length, 1);
  });

  await test("intro: role cursors converge and merge into the agent cursor", async () => {
    merges.length = 0;
    const bar = fakeElement(600) as unknown as HTMLElement;
    const roles = ["layout", "copy", "media", "style"];
    const spot = (r: DOMRect) => ({ x: r.left + 24, y: r.top + 20 });
    assert.equal(
      await choreo.enqueue([
        {
          kind: "parallel",
          tracks: roles.map((c) => [
            { kind: "moveTo", cursor: c, target: bar, scroll: false, aim: spot, ms: 100 } as Step,
          ]),
        },
        { kind: "merge", cursors: roles, into: "agent", target: bar, aim: spot },
        // the agent is already at the merge point, so this is not a flight
        { kind: "moveTo", cursor: "agent", target: bar, scroll: false, aim: spot },
      ]),
      true
    );
    assert.equal(moves.length, 4, "one converging flight per role, none for the agent");
    assert.ok(moves.every((m) => m.to.x === 124 && m.to.y === 620), "all meet at one point");
    assert.deepEqual(merges, [{ cursors: roles, into: "agent", at: { x: 124, y: 620 } }]);
  });

  await test("intro: waitForDriver resolves at once when a driver is attached", async () => {
    const t = performance.now();
    assert.equal(await choreo.waitForDriver(1000), true);
    assert.ok(performance.now() - t < 50);
  });

  console.log(`\n${passed} choreo tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

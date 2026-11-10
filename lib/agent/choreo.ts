"use client";

import {
  isComfortablyVisible,
  resolveTarget,
  scrollToElement,
} from "@/lib/agent/targets";
import { setAgentState } from "@/lib/agent/store";

// Cursor engine. One queue of steps shared by agent actions and (phase 3) the
// boot intro. The visual side is a CursorDriver registered by
// components/agent/cursor.tsx; without one (reduced motion, not mounted) the
// engine still runs every effect, just with no flight and no waits.
//
// The agent never fights the visitor. A trusted click, tap or key press cancels
// the whole queue immediately. Scrolling (wheel or touch) only pauses it: the
// step in flight is stopped, and RESUME_AFTER_MS after the last scroll event it
// is run again from scratch, so the target is re-resolved and the cursor path
// recomputed against the viewport the visitor left. Scrolling for longer than
// MAX_PAUSE_MS counts as a cancel.

export interface Point {
  x: number;
  y: number;
}

/** an agent id, an element, or a resolver evaluated when the step runs */
export type Target = string | HTMLElement | (() => HTMLElement | null);

export type Step =
  | { kind: "moveTo"; target: Target; cursor?: string }
  | { kind: "click"; cursor?: string }
  | { kind: "type"; el: HTMLInputElement | HTMLTextAreaElement; text: string; cursor?: string }
  | { kind: "drag"; from: Target; to: Target; cursor?: string }
  | { kind: "wait"; ms: number }
  | { kind: "run"; fn: (signal: AbortSignal) => void | Promise<void> }
  | { kind: "parallel"; tracks: Step[][] };

export interface CursorDriver {
  move(cursor: string, to: Point, ms: number, signal: AbortSignal): Promise<void>;
  click(cursor: string, signal: AbortSignal): Promise<void>;
  press(cursor: string, down: boolean): void;
  hideAll(): void;
}

export const DEFAULT_CURSOR = "agent";

const MOVE_MIN_MS = 350;
const MOVE_MAX_MS = 600;
const TYPE_CHAR_MS = 35;
// `click` is how a touch tap cancels: a touch pointerdown may be the start of a
// scroll, so it is ignored and the tap is caught when it completes
const CANCEL_EVENTS = ["pointerdown", "keydown", "click"] as const;
// `scroll` only counts while already paused (momentum after a touch flick);
// otherwise it could be the agent's own smooth scroll
const SCROLL_EVENTS = ["wheel", "touchmove", "scroll"] as const;
export const RESUME_AFTER_MS = 500;
export const MAX_PAUSE_MS = 4000;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * where the cursor tip lands: a child marked data-agent-aim (a section's
 * heading) if there is one, else the element - its centre, or near the
 * top-left of big blocks
 */
function aimPoint(target: HTMLElement): Point {
  const el = target.querySelector<HTMLElement>("[data-agent-aim]") ?? target;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + Math.min(r.width / 2, 120),
    y: r.top + Math.min(r.height / 2, 28),
  };
}

// set an input's value so React's onChange sees it
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

interface Batch {
  steps: Step[];
  resolve: (completed: boolean) => void;
}

class Choreo {
  private driver: CursorDriver | null = null;
  private queue: Batch[] = [];
  /** the current batch: aborted by a cancel */
  private controller: AbortController | null = null;
  /** the current try at a step: aborted by a cancel and by a pause */
  private attempt: AbortController | null = null;
  private running = false;
  private paused = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;
  private pauseLimitTimer: ReturnType<typeof setTimeout> | undefined;
  private waiters: (() => void)[] = [];
  private positions = new Map<string, Point>();

  attach(driver: CursorDriver) {
    this.driver = driver;
    return () => {
      if (this.driver === driver) this.driver = null;
    };
  }

  get busy() {
    return this.running;
  }

  /** queue steps; resolves true once they all ran, false if cancelled */
  enqueue(steps: Step[]): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({ steps, resolve });
      if (!this.running) void this.drain();
    });
  }

  /** stop everything now: current animation, current batch, all queued batches */
  cancel = () => {
    this.controller?.abort();
    this.attempt?.abort();
    const dropped = this.queue.splice(0);
    dropped.forEach((b) => b.resolve(false));
    this.endPause();
  };

  private onCancelInput = (e: Event) => {
    if (!e.isTrusted) return;
    if (e.type === "pointerdown" && (e as PointerEvent).pointerType === "touch") return;
    this.cancel();
  };

  private onScrollInput = (e: Event) => {
    if (!e.isTrusted) return;
    if (e.type === "scroll" && !this.paused) return;
    this.pause();
  };

  /** hold the queue; every scroll event pushes the resume back */
  private pause() {
    if (!this.paused) {
      this.paused = true;
      this.attempt?.abort();
      this.pauseLimitTimer = setTimeout(this.cancel, MAX_PAUSE_MS);
    }
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(this.endPause, RESUME_AFTER_MS);
  }

  /** leave the paused state and wake the step loop (to retry, or to see a cancel) */
  private endPause = () => {
    clearTimeout(this.resumeTimer);
    clearTimeout(this.pauseLimitTimer);
    this.paused = false;
    this.waiters.splice(0).forEach((wake) => wake());
  };

  private async drain() {
    this.running = true;
    setAgentState({ executing: true });
    CANCEL_EVENTS.forEach((t) =>
      window.addEventListener(t, this.onCancelInput, { capture: true, passive: true })
    );
    SCROLL_EVENTS.forEach((t) =>
      window.addEventListener(t, this.onScrollInput, { capture: true, passive: true })
    );

    while (this.queue.length) {
      const batch = this.queue.shift()!;
      const controller = new AbortController();
      this.controller = controller;
      await this.runSteps(batch.steps, controller.signal);
      batch.resolve(!controller.signal.aborted);
    }

    CANCEL_EVENTS.forEach((t) =>
      window.removeEventListener(t, this.onCancelInput, { capture: true })
    );
    SCROLL_EVENTS.forEach((t) =>
      window.removeEventListener(t, this.onScrollInput, { capture: true })
    );
    this.endPause();
    this.controller = null;
    this.attempt = null;
    this.running = false;
    this.driver?.hideAll();
    this.positions.clear();
    setAgentState({ executing: false });
  }

  /**
   * Run steps in order. `batch` aborts on cancel. Each step runs against the
   * current attempt signal, which a pause aborts too: a step cut short by a
   * pause is run again once the visitor stops scrolling.
   */
  private async runSteps(steps: Step[], batch: AbortSignal) {
    for (const step of steps) {
      for (;;) {
        while (this.paused && !batch.aborted) {
          await new Promise<void>((wake) => this.waiters.push(wake));
        }
        if (batch.aborted) return;
        if (step.kind === "parallel") {
          // each track pauses and retries its own steps
          await Promise.all(step.tracks.map((t) => this.runSteps(t, batch)));
          break;
        }
        if (!this.attempt || this.attempt.signal.aborted) {
          this.attempt = new AbortController();
        }
        const signal = this.attempt.signal;
        await this.runStep(step, signal);
        if (batch.aborted) return;
        if (!signal.aborted) break;
      }
    }
  }

  private async runStep(step: Step, signal: AbortSignal): Promise<void> {
    const reduced = prefersReducedMotion() || !this.driver;
    const cursor = ("cursor" in step && step.cursor) || DEFAULT_CURSOR;

    switch (step.kind) {
      case "moveTo":
        await this.moveTo(cursor, step.target, reduced, signal);
        return;
      case "click":
        if (!reduced) await this.driver!.click(cursor, signal);
        return;
      case "wait":
        if (!reduced) await sleep(step.ms, signal);
        return;
      case "run":
        await step.fn(signal);
        return;
      case "type": {
        if (reduced) {
          setNativeValue(step.el, step.text);
          return;
        }
        await this.moveTo(cursor, step.el, reduced, signal);
        for (let i = 1; i <= step.text.length; i++) {
          if (signal.aborted) return;
          setNativeValue(step.el, step.text.slice(0, i));
          await sleep(TYPE_CHAR_MS, signal);
        }
        return;
      }
      case "drag":
        await this.moveTo(cursor, step.from, reduced, signal);
        if (reduced || signal.aborted) return;
        this.driver!.press(cursor, true);
        await this.moveTo(cursor, step.to, reduced, signal);
        this.driver?.press(cursor, false);
        return;
      case "parallel":
        return; // handled by runSteps
    }
  }

  private async moveTo(cursor: string, target: Target, reduced: boolean, signal: AbortSignal) {
    const el =
      typeof target === "string"
        ? resolveTarget(target)
        : typeof target === "function"
          ? target()
          : target;
    if (!el) return;
    if (!isComfortablyVisible(el)) {
      await scrollToElement(el, { instant: reduced, signal });
    }
    if (reduced || signal.aborted) return;

    const to = aimPoint(el);
    const from = this.positions.get(cursor);
    const dist = from ? Math.hypot(to.x - from.x, to.y - from.y) : 400;
    const ms = Math.min(MOVE_MAX_MS, Math.max(MOVE_MIN_MS, MOVE_MIN_MS + dist * 0.25));
    await this.driver!.move(cursor, to, ms, signal);
    this.positions.set(cursor, to);
  }
}

export const choreo = new Choreo();

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
// Any trusted visitor input (wheel, touch, pointer, key) cancels the whole
// queue immediately: the agent never fights the visitor.

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
const CANCEL_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

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
  private controller: AbortController | null = null;
  private running = false;
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
    const dropped = this.queue.splice(0);
    dropped.forEach((b) => b.resolve(false));
  };

  private onVisitorInput = (e: Event) => {
    if (e.isTrusted) this.cancel();
  };

  private async drain() {
    this.running = true;
    setAgentState({ executing: true });
    CANCEL_EVENTS.forEach((t) =>
      window.addEventListener(t, this.onVisitorInput, { capture: true, passive: true })
    );

    while (this.queue.length) {
      const batch = this.queue.shift()!;
      const controller = new AbortController();
      this.controller = controller;
      await this.runSteps(batch.steps, controller.signal);
      batch.resolve(!controller.signal.aborted);
    }

    CANCEL_EVENTS.forEach((t) =>
      window.removeEventListener(t, this.onVisitorInput, { capture: true })
    );
    this.controller = null;
    this.running = false;
    this.driver?.hideAll();
    this.positions.clear();
    setAgentState({ executing: false });
  }

  private async runSteps(steps: Step[], signal: AbortSignal) {
    for (const step of steps) {
      if (signal.aborted) return;
      await this.runStep(step, signal);
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
        this.driver!.press(cursor, false);
        return;
      case "parallel":
        await Promise.all(step.tracks.map((t) => this.runSteps(t, signal)));
        return;
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

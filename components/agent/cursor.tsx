"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate as rawAnimate,
  motion,
  useMotionValue,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { getRate, onRate, sleep } from "@/lib/agent/clock";
import {
  choreo,
  prefersReducedMotion,
  type CursorDriver,
  type Point,
} from "@/lib/agent/choreo";
import { agentId, resolveTarget } from "@/lib/agent/targets";

// Visual side of the cursor engine: fixed-position SVG arrows with a role
// label, flown along a curved path by Framer Motion. The agent uses one; the
// boot intro uses the four role cursors. Decorative only (aria-hidden): the
// tool log in the command bar is the accessible record of what ran.

export interface CursorRole {
  id: string;
  label: string;
  color: string;
  /** where the cursor enters when it is not on screen yet (default: command input) */
  spawn?: (vw: number, vh: number) => Point;
}

// The four intro roles each have their own colour (--intro-* tokens, used
// nowhere else); at the end of the intro they dock into the one accent-coloured
// agent cursor, which is the only cursor the rest of the site ever shows.
// Each docks into it on its own, as soon as its work is done.
export const CURSOR_ROLES: CursorRole[] = [
  { id: "agent", label: "agent", color: "var(--accent)" },
  { id: "layout", label: "layout", color: "var(--intro-layout)", spawn: (_, vh) => ({ x: -24, y: vh * 0.85 }) },
  { id: "copy", label: "copy", color: "var(--intro-copy)", spawn: (_, vh) => ({ x: -24, y: vh * 0.15 }) },
  { id: "media", label: "media", color: "var(--intro-media)", spawn: (vw, vh) => ({ x: vw * 0.6, y: vh + 24 }) },
  { id: "style", label: "style", color: "var(--intro-style)", spawn: (vw, vh) => ({ x: vw + 24, y: vh * 0.4 }) },
];

const ROLE_BY_ID = new Map(CURSOR_ROLES.map((r) => [r.id, r]));

interface Handle {
  x: MotionValue<number>;
  y: MotionValue<number>;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  ripple: () => void;
}

const EASE = [0.45, 0, 0.2, 1] as const;

// Opt-in trace for the browser checks (scripts/test-intro.ts): when a page sets
// window.__cursorTrace to an array, every flight and dock is recorded in it.
export interface CursorTraceEntry {
  kind: "move" | "dock";
  id: string;
  t: number;
  ms?: number;
  straight?: boolean;
  from?: Point;
  to: Point;
}
declare global {
  interface Window {
    __cursorTrace?: CursorTraceEntry[];
  }
}
function trace(e: Omit<CursorTraceEntry, "t">) {
  window.__cursorTrace?.push({ ...e, t: performance.now() });
}

/** spawn point for a cursor that is not on screen yet */
function spawnPoint(id: string): Point {
  const spawn = ROLE_BY_ID.get(id)?.spawn;
  if (spawn) return spawn(window.innerWidth, window.innerHeight);
  const input = resolveTarget(agentId.commandInput());
  if (input) {
    const r = input.getBoundingClientRect();
    return { x: r.left + 24, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 48 };
}

// quadratic bezier with the control point bowed off the straight line
export const BOW = 0.18;
export function bowControl(from: Point, to: Point, bow = BOW): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: from.x + dx / 2 - dy * bow, y: from.y + dy / 2 + dx * bow };
}
function curve(from: Point, to: Point, bow = BOW) {
  const c = bowControl(from, to, bow);
  return (t: number): Point => ({
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * c.x + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * c.y + t ** 2 * to.y,
  });
}

function play(
  run: (onDone: () => void) => { stop: () => void },
  signal: AbortSignal
) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const controls = run(resolve);
    signal.addEventListener("abort", () => {
      controls.stop();
      resolve();
    });
  });
}

/** wait `ms` on the choreography clock, or less if aborted */
const hold = (ms: number, signal: AbortSignal) => sleep(ms, signal);

// Every cursor animation runs at the choreography clock's rate (lib/agent/
// clock.ts), including ones already in flight when it changes: the intro's
// fast-forward speeds up a flight mid-air instead of letting it finish slowly.
const live = new Set<AnimationPlaybackControls>();
const prune = () => live.forEach((c) => c.state === "finished" && live.delete(c));
onRate((rate) => {
  prune();
  live.forEach((c) => (c.speed = rate));
});
const animate = ((...args: unknown[]) => {
  const c = (rawAnimate as (...a: unknown[]) => AnimationPlaybackControls)(...args);
  c.speed = getRate();
  if (live.size > 32) prune();
  live.add(c);
  return c;
}) as typeof rawAnimate;

function OneCursor({
  role,
  register,
}: {
  role: CursorRole;
  register: (id: string, h: Handle | null) => void;
}) {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(1);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    register(role.id, { x, y, opacity, scale, ripple: () => setClicks((c) => c + 1) });
    return () => register(role.id, null);
  }, [role.id, register, x, y, opacity, scale]);

  return (
    <motion.div
      className="agent-cursor"
      // each cursor and its role label (agent, layout, copy, media, style) is
      // hidden from assistive tech on its own, not only through the layer
      aria-hidden="true"
      style={{ x, y, opacity, "--cursor-color": role.color } as never}
    >
      <motion.svg
        width="18"
        height="22"
        viewBox="0 0 18 22"
        style={{ scale, originX: 0, originY: 0 }}
      >
        <path
          d="M1 1 L1 18 L5.6 13.6 L8.9 20.8 L12 19.4 L8.8 12.4 L15 12.4 Z"
          fill="var(--cursor-color)"
          stroke="var(--ground)"
          strokeWidth="1.2"
          strokeLinejoin="miter"
        />
      </motion.svg>
      <span className="agent-cursor-label" aria-hidden="true">
        {role.label}
      </span>
      {clicks > 0 && <span key={clicks} className="agent-cursor-ripple" />}
    </motion.div>
  );
}

export function CursorLayer() {
  const handles = useRef(new Map<string, Handle>());
  const [register] = useState(() => (id: string, h: Handle | null) => {
    if (h) handles.current.set(id, h);
    else handles.current.delete(id);
  });

  useEffect(() => {
    if (prefersReducedMotion()) return; // engine runs effects without a driver

    const get = (id: string) => handles.current.get(id) ?? handles.current.get("agent")!;

    const driver: CursorDriver = {
      async move(id, to, ms, signal, opts) {
        const h = get(id);
        if (h.opacity.get() === 0) {
          const s = spawnPoint(id);
          h.x.set(s.x);
          h.y.set(s.y);
        }
        // also cancels a pending fade-out if a new batch starts right away
        animate(h.opacity, 1, { duration: 0.15 });
        const from = { x: h.x.get(), y: h.y.get() };
        trace({ kind: "move", id, ms, straight: !!opts?.straight, from, to });
        const path = curve(from, to, opts?.straight ? 0 : BOW * (opts?.bowSide ?? 1));
        await play(
          (done) =>
            animate(0, 1, {
              duration: ms / 1000,
              // a straight (drag) leg is linear so it can track a reveal edge
              ease: opts?.straight ? "linear" : EASE,
              onUpdate: (t) => {
                const p = path(t);
                h.x.set(p.x);
                h.y.set(p.y);
              },
              onComplete: done,
            }),
          signal
        );
      },
      async click(id, signal) {
        const h = get(id);
        h.ripple();
        await play(
          (done) =>
            animate(h.scale, [1, 0.82, 1], { duration: 0.22, onComplete: done }),
          signal
        );
      },
      press(id, down) {
        animate(get(id).scale, down ? 0.85 : 1, { duration: 0.12 });
      },
      async dock(id, into, at, signal) {
        const h = get(id);
        const target = get(into);
        trace({ kind: "dock", id, to: at });
        if (h !== target) {
          // shrink into the point, then reset for the next time it appears
          animate(h.opacity, 0, { duration: 0.22 });
          animate(h.scale, 0.5, { duration: 0.22, onComplete: () => h.scale.set(1) });
        }
        // timed by the clock, not the animation: a cursor docking right after
        // restarts the agent's scale, and the earlier one must still finish
        if (target.opacity.get() < 0.5) {
          // the first to dock: the agent grows out of it with a small overshoot
          target.x.set(at.x);
          target.y.set(at.y);
          target.scale.set(0.5);
          animate(target.opacity, 1, { duration: 0.12 });
          animate(target.scale, [0.5, 1.18, 1], { duration: 0.32, ease: EASE });
          await hold(320, signal);
          return;
        }
        // later ones are absorbed: the agent stays put and pulses once
        animate(target.scale, [1, 1.12, 1], { duration: 0.26, ease: EASE });
        await hold(260, signal);
      },
      hideAll() {
        handles.current.forEach((h) => animate(h.opacity, 0, { duration: 0.4, delay: 0.5 }));
      },
    };

    return choreo.attach(driver);
  }, []);

  return (
    <div className="agent-cursors" aria-hidden="true">
      {CURSOR_ROLES.map((r) => (
        <OneCursor key={r.id} role={r} register={register} />
      ))}
    </div>
  );
}

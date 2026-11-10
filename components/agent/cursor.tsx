"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type MotionValue } from "framer-motion";
import {
  choreo,
  prefersReducedMotion,
  type CursorDriver,
  type Point,
} from "@/lib/agent/choreo";
import { agentId, resolveTarget } from "@/lib/agent/targets";

// Visual side of the cursor engine: fixed-position SVG arrows with a role
// label, flown along a curved path by Framer Motion. The agent uses one; the
// phase 3 intro registers four more roles here. Decorative only (aria-hidden):
// the tool log in the command bar is the accessible record of what ran.

export interface CursorRole {
  id: string;
  label: string;
  color: string;
}

export const CURSOR_ROLES: CursorRole[] = [
  { id: "agent", label: "agent", color: "var(--accent)" },
];

interface Handle {
  x: MotionValue<number>;
  y: MotionValue<number>;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  ripple: () => void;
}

const EASE = [0.45, 0, 0.2, 1] as const;

/** spawn point for a cursor that is not on screen yet: the command bar input */
function spawnPoint(): Point {
  const input = resolveTarget(agentId.commandInput());
  if (input) {
    const r = input.getBoundingClientRect();
    return { x: r.left + 24, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 48 };
}

// quadratic bezier with the control point bowed off the straight line
function curve(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = { x: from.x + dx / 2 - dy * 0.18, y: from.y + dy / 2 + dx * 0.18 };
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
      <span className="agent-cursor-label">{role.label}</span>
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
      async move(id, to, ms, signal) {
        const h = get(id);
        if (h.opacity.get() === 0) {
          const s = spawnPoint();
          h.x.set(s.x);
          h.y.set(s.y);
        }
        // also cancels a pending fade-out if a new batch starts right away
        animate(h.opacity, 1, { duration: 0.15 });
        const path = curve({ x: h.x.get(), y: h.y.get() }, to);
        await play(
          (done) =>
            animate(0, 1, {
              duration: ms / 1000,
              ease: EASE,
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

"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/agent/choreo";

// Pointer effects (phase 4): a soft spotlight that follows the pointer across
// the background, and a magnetic pull on the primary buttons ([data-magnet]).
// Both run on one requestAnimationFrame loop that only ticks while something
// is still settling, write transforms only (no layout), and are off entirely
// under reduced motion and on touch devices (no fine hover pointer).
// The spotlight is neutral white at a few percent: --accent stays the agent's.

const SPOT_SIZE = 900;
const SPOT_EASE = 10;
const MAGNET_REACH = 56; // px outside the button where the pull starts
const MAGNET_PULL = 0.28; // of the pointer's offset from the button centre
const MAGNET_MAX = 9; // px
const MAGNET_EASE = 14;

interface Magnet {
  el: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export function PointerEffects() {
  const [on, setOn] = useState(false);
  const spot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setOn(true);
  }, []);

  useEffect(() => {
    if (!on) return;
    const spotEl = spot.current;
    const magnets: Magnet[] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-magnet]")
    ).map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));

    let px = -1;
    let py = -1;
    let sx = 0;
    let sy = 0;
    let seen = false;
    let shown = false;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      let settling = false;

      if (spotEl && seen) {
        const k = 1 - Math.exp(-dt * SPOT_EASE);
        sx += (px - sx) * k;
        sy += (py - sy) * k;
        spotEl.style.transform = `translate3d(${(sx - SPOT_SIZE / 2).toFixed(1)}px, ${(sy - SPOT_SIZE / 2).toFixed(1)}px, 0)`;
        if (Math.abs(px - sx) > 0.3 || Math.abs(py - sy) > 0.3) settling = true;
      }

      for (const m of magnets) {
        const k = 1 - Math.exp(-dt * MAGNET_EASE);
        m.x += (m.tx - m.x) * k;
        m.y += (m.ty - m.y) * k;
        if (Math.abs(m.x) + Math.abs(m.y) < 0.05 && m.tx === 0 && m.ty === 0) {
          if (m.el.style.translate) m.el.style.translate = "";
          m.x = m.y = 0;
          continue;
        }
        m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
        settling = true;
      }

      if (settling) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!seen) {
        seen = true;
        sx = px;
        sy = py;
      }
      if (spotEl && !shown) {
        shown = true;
        spotEl.dataset.on = "";
      }
      for (const m of magnets) {
        const r = m.el.getBoundingClientRect();
        // distance from the pointer to the button's box (0 inside it)
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        const outside = Math.hypot(dx, dy);
        const strength = 1 - Math.min(outside / MAGNET_REACH, 1);
        if (strength <= 0) {
          m.tx = m.ty = 0;
          continue;
        }
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const clampPull = (v: number) => Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, v));
        m.tx = clampPull((px - cx) * MAGNET_PULL * strength);
        m.ty = clampPull((py - cy) * MAGNET_PULL * strength);
      }
      wake();
    };
    const onLeave = () => {
      if (spotEl) {
        shown = false;
        delete spotEl.dataset.on;
      }
      magnets.forEach((m) => (m.tx = m.ty = 0));
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      magnets.forEach((m) => (m.el.style.translate = ""));
    };
  }, [on]);

  if (!on) return null;
  return <div className="spotlight" ref={spot} aria-hidden="true" />;
}

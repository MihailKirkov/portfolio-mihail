"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// Pieces shared by the two R3F scenes, the shader core
// (components/core/shader-core.tsx) and the projects depth scene
// (components/projects/depth-gl.tsx). Both import three and R3F from here and
// from their own module, so the bundler keeps one shared three chunk.

/**
 * A colour token from globals.css as a vec3, so --accent and the ground stay
 * a one-line change. The shaders write straight to the sRGB canvas, so the
 * token values are used as-is.
 */
export function cssColor(name: string, fallback: string): THREE.Vector3 {
  let hex = fallback;
  if (typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) hex = v;
  }
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Our own frame loop for a Canvas with frameloop="never": runs only while
 * `active`, at most `fps` frames a second when capped (0 = every frame). A
 * resize lifts the cap briefly so the canvas is redrawn at its new size on
 * the very next frame. R3F's clock stops with it, so nothing jumps on resume.
 */
export function Loop({ active, fps }: { active: boolean; fps: number }) {
  const advance = useThree((s) => s.advance);
  const size = useThree((s) => s.size);
  const resizedAt = useRef(0);
  useEffect(() => {
    resizedAt.current = performance.now();
  }, [size]);
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = -Infinity;
    const tick = (t: number) => {
      id = requestAnimationFrame(tick);
      const capped = fps > 0 && t - resizedAt.current > 150;
      if (capped && t - last < 1000 / fps - 1) return;
      last = t;
      advance(t / 1000);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, fps, advance]);
  return null;
}

/** forwards a lost WebGL context to the gate, which falls back to the static version */
export function ContextLoss({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}

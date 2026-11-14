"use client";

import { useEffect, useRef } from "react";
import { position, velocity } from "@/lib/scroll";

// The lime stream (target docs/design/lime-stream.html, at its lowest
// intensity): one fixed canvas 2D layer behind the whole page. A milky-way
// ribbon along a cubic spine whose shape is keyed per section and blended
// from the Lenis scroll value; scroll velocity drives its turbulence. Three
// layers: a low-res blurred haze, fine silk fibres and drifting star dust,
// creamy white at the core, lime in the body, cool blue at the edges. In the
// contact finale it is mirrored from both sides and converges into the core.
//
// Canvas 2D, not WebGL: the page already runs up to three WebGL contexts
// (core + two scenes) and the budget allows no more. Measured (_r2/bench):
// 2D ~7ms a frame, an equivalent full-screen shader ~3-4ms but a fourth
// context; so 2D, at 30fps at rest and on phones, full rate while scrolling.
// Decorative only: aria-hidden, no pointer events, never on the critical path
// (lazy chunk, starts after the boot intro lets go of the page).

const INTENSITY = 0.15;
type Key = "hero" | "projects" | "stack" | "experience" | "contact";
const KEYS: Key[] = ["hero", "projects", "stack", "experience", "contact"];

interface Shape {
  p: [number, number][];
  w: number;
  pinch: number;
  min: number;
  mirror: number;
  /** extra dim for text-heavy sections */
  a: number;
}

// cubic spine in viewport units, ribbon width, pinch point, mirrored twin
const KF: Record<Key, Shape> = {
  hero: { p: [[-0.15, 1.05], [0.3, 0.8], [0.52, 0.3], [1.15, -0.1]], w: 0.42, pinch: 0.48, min: 0.05, mirror: 0, a: 1 },
  projects: { p: [[-0.15, 0.15], [0.35, 0.05], [0.58, 0.95], [1.15, 0.72]], w: 0.36, pinch: 0.55, min: 0.05, mirror: 0, a: 0.9 },
  stack: { p: [[-0.15, 0.88], [0.22, -0.2], [0.78, -0.2], [1.15, 0.92]], w: 0.3, pinch: 0.5, min: 0.08, mirror: 0, a: 1 },
  experience: { p: [[0.2, 1.15], [0.42, 0.78], [0.66, 0.42], [0.8, -0.15]], w: 0.26, pinch: 0.62, min: 0.05, mirror: 0, a: 0.8 },
  contact: { p: [[-0.15, 1.05], [0.12, 0.7], [0.34, 0.36], [0.5, 0.3]], w: 0.55, pinch: 1, min: 0, mirror: 1, a: 1 },
};

interface Fibre {
  o: number;
  ph: number;
  fr: number;
  sp: number;
  amp: number;
  w: number;
}
interface Dust {
  f: Fibre;
  t: number;
  v: number;
  s: number;
  tw: number;
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const clone = (k: Shape): Shape => ({ ...k, p: k.p.map((q) => [q[0], q[1]] as [number, number]) });
function mix(A: Shape, B: Shape, f: number): Shape {
  return {
    p: A.p.map((q, i) => [lerp(q[0], B.p[i][0], f), lerp(q[1], B.p[i][1], f)] as [number, number]),
    w: lerp(A.w, B.w, f),
    pinch: lerp(A.pinch, B.pinch, f),
    min: lerp(A.min, B.min, f),
    mirror: lerp(A.mirror, B.mirror, f),
    a: lerp(A.a, B.a, f),
  };
}
function gauss() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v);
}
const gclamp = (s: number) => Math.max(-1.15, Math.min(1.15, gauss() * s));
const fibre = (s: number, amp: number, w = 1): Fibre => ({
  o: gclamp(s),
  ph: Math.random() * 6.28,
  fr: 0.5 + Math.random() * 1.1,
  sp: 0.15 + Math.random() * 0.35,
  amp: Math.random() * amp,
  w,
});

// colour across the band: creamy white core, lime body, cool blue edges
function tint(o: number, a: number) {
  const e = Math.min(1, Math.abs(o));
  if (e < 0.22) return `rgba(242,255,205,${a})`;
  if (e < 0.6) return `rgba(200,245,66,${a})`;
  return `rgba(120,190,235,${a * 0.85})`;
}

export function LimeStream() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const html = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hc = document.createElement("canvas");
    const hctx = hc.getContext("2d");
    if (!hctx) return;
    const HS = 0.22; // haze resolution scale
    const canFilter = "filter" in ctx;

    let W = 0;
    let H = 0;
    let small = false;
    const fibres: Fibre[] = [];
    const haze: Fibre[] = [];
    const dust: Dust[] = [];

    // section centres in document px, re-measured on resize and now and then
    // (the depth and journey tracks size themselves after hydration)
    let centres: { k: Key; c: number }[] = [];
    const measure = () => {
      const y = position();
      // the stack's plain tiered list (phones, reduced motion, no WebGL) is
      // text-heavy: the stream drops further back behind it
      KF.stack.a = document.querySelector(".stack-stage[data-constellation]") ? 1 : 0.55;
      centres = KEYS.flatMap((k) => {
        const el = document.getElementById(k);
        if (!el) return [];
        const r = el.getBoundingClientRect();
        return [{ k, c: r.top + y + r.height / 2 }];
      });
    };
    function target(): Shape {
      if (!centres.length) return KF.hero;
      const c = position() + H / 2;
      if (c <= centres[0].c) return KF[centres[0].k];
      for (let i = 0; i < centres.length - 1; i++) {
        if (c < centres[i + 1].c) {
          let f = (c - centres[i].c) / (centres[i + 1].c - centres[i].c);
          f = f * f * (3 - 2 * f);
          return mix(KF[centres[i].k], KF[centres[i + 1].k], f);
        }
      }
      return KF[centres[centres.length - 1].k];
    }
    /** reduced motion: the nearest section's own frame, no blend */
    function nearest(): Key {
      const c = position() + H / 2;
      let best = centres[0]?.k ?? "hero";
      let d = Infinity;
      for (const s of centres) {
        const dd = Math.abs(s.c - c);
        if (dd < d) {
          d = dd;
          best = s.k;
        }
      }
      return best;
    }

    function build() {
      fibres.length = haze.length = dust.length = 0;
      const N = small ? 90 : 220;
      for (let i = 0; i < N; i++) fibres.push(fibre(0.42, 0.012, 0.6 + Math.random() * 1.1));
      for (let i = 0; i < (small ? 18 : 40); i++) {
        const f = fibre(0.4, 0.01);
        f.fr = 0.4 + Math.random() * 0.8;
        f.sp = 0.1 + Math.random() * 0.25;
        haze.push(f);
      }
      for (let i = 0; i < (small ? 120 : 360); i++) {
        const f = fibre(0.5, 0.01);
        f.fr = 0.5 + Math.random();
        f.sp = 0.2;
        f.amp = 0.01;
        dust.push({ f, t: Math.random(), v: 0.004 + Math.random() * 0.02, s: 0.5 + Math.random() * Math.random() * 2.2, tw: Math.random() * 6.28 });
      }
    }
    let dpr = 1;
    function resize() {
      const wasSmall = small;
      W = window.innerWidth;
      H = window.innerHeight;
      small = W < 700;
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : 1.5);
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      hc.width = Math.max(1, Math.round(W * HS));
      hc.height = Math.max(1, Math.round(H * HS));
      if (!fibres.length || wasSmall !== small) build();
      measure();
    }

    let cur = clone(KF.hero);
    let time = 0;
    const S = () => Math.min(W, H) * 1.15;

    // a point on fibre f at t along the spine, offset across the band
    function point(f: Fibre, t: number, turb: number, flip: boolean, s: number): [number, number] {
      const P = cur.p;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      let x = (a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0]) * W;
      let y = (a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]) * H;
      const dx = (3 * u * u * (P[1][0] - P[0][0]) + 6 * u * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0])) * W;
      const dy = (3 * u * u * (P[1][1] - P[0][1]) + 6 * u * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1])) * H;
      const len = Math.hypot(dx, dy) || 1;
      const prof = cur.min + (1 - cur.min) * Math.min(1, Math.pow(Math.abs(t - cur.pinch) * 2, 1.4));
      const twist = 0.7 + 0.3 * Math.cos(t * 1.6 - time * 0.18 + f.o * 0.7);
      const wave = Math.sin(t * f.fr * 6.28 + time * f.sp + f.ph) * (f.amp + turb * 0.02) * s;
      const off = cur.w * s * prof * f.o * twist + wave;
      x += (-dy / len) * off;
      y += (dx / len) * off;
      return [flip ? W - x : x, y];
    }

    function ribbon(turb: number, flip: boolean, am: number) {
      const k = INTENSITY * am * cur.a;
      const s = S();
      const steps = small ? 32 : 48;
      // 1. haze: thick at low resolution, scaled up and blurred
      hctx!.setTransform(HS, 0, 0, HS, 0, 0);
      hctx!.globalCompositeOperation = "source-over";
      hctx!.clearRect(0, 0, W, H);
      hctx!.globalCompositeOperation = "lighter";
      hctx!.lineCap = "round";
      for (const f of haze) {
        const c = 1 - Math.min(1, Math.abs(f.o));
        hctx!.strokeStyle = tint(f.o, (0.05 + 0.1 * c) * k);
        hctx!.lineWidth = 26 + 30 * c;
        hctx!.beginPath();
        for (let i = 0; i <= 28; i++) {
          const [x, y] = point(f, i / 28, turb, flip, s);
          if (i) hctx!.lineTo(x, y);
          else hctx!.moveTo(x, y);
        }
        hctx!.stroke();
      }
      if (canFilter) ctx!.filter = "blur(10px)";
      ctx!.drawImage(hc, 0, 0, W, H);
      if (canFilter) ctx!.filter = "none";
      // 2. silk: many fine, faint fibres, dense in the middle
      for (const f of fibres) {
        const c = 1 - Math.min(1, Math.abs(f.o));
        ctx!.lineWidth = f.w;
        ctx!.strokeStyle = tint(f.o, (0.012 + 0.07 * c * c) * k);
        ctx!.beginPath();
        for (let i = 0; i <= steps; i++) {
          const [x, y] = point(f, i / steps, turb, flip, s);
          if (i) ctx!.lineTo(x, y);
          else ctx!.moveTo(x, y);
        }
        ctx!.stroke();
      }
      // 3. star dust drifting through the band
      for (const d of dust) {
        const [x, y] = point(d.f, d.t, turb, flip, s);
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.2 + d.tw));
        ctx!.fillStyle = tint(d.f.o * 0.6, 0.55 * tw * k);
        ctx!.beginPath();
        ctx!.arc(x, y, d.s, 0, 6.283);
        ctx!.fill();
      }
    }

    function draw(turb: number, dt: number) {
      ctx!.clearRect(0, 0, W, H);
      for (const d of dust) {
        d.t += d.v * dt * (1 + turb * 2);
        if (d.t > 1) d.t -= 1;
      }
      ctx!.globalCompositeOperation = "lighter";
      ribbon(turb, false, 1);
      if (cur.mirror > 0.02) ribbon(turb, true, cur.mirror);
      ctx!.globalCompositeOperation = "source-over";
    }

    resize();
    const onResize = () => {
      resize();
      if (reduce) still(true);
    };
    window.addEventListener("resize", onResize);
    const remeasure = window.setInterval(measure, 2000);

    // reduced motion: one static frame per section, redrawn only when the
    // nearest section changes
    let shown: Key | null = null;
    function still(force = false) {
      const k = nearest();
      if (k === shown && !force) return;
      shown = k;
      cur = clone(KF[k]);
      time = 0;
      draw(0, 0);
      cv!.dataset.frame = k;
    }

    let raf = 0;
    let last = 0;
    let vel = 0;
    // 30fps on phones always, and on desktop at rest (the drift is slow);
    // full rate only while the visitor scrolls or the shape is morphing
    const CAP = 1000 / 30 - 2;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Lenis velocity is px per frame; the reference's 2500 px/s saturates
      const v = velocity() * 60;
      const tgt = target();
      const moving = Math.abs(v) > 30 || Math.abs(vel) > 30 || Math.abs(tgt.p[1][1] - cur.p[1][1]) + Math.abs(tgt.p[2][0] - cur.p[2][0]) > 0.002;
      if (last && now - last < (small || !moving ? CAP : 0)) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      cur = mix(cur, tgt, 1 - Math.pow(1 - 0.06, dt * 60));
      vel = lerp(vel, v, 0.15);
      const turb = Math.min(1, Math.abs(vel) / 2500);
      time += dt * (1 + turb * 2.5);
      draw(turb, dt);
    };
    const run = () => {
      const go = !document.hidden && !html.hasAttribute("data-intro");
      if (go && !raf) {
        last = 0;
        measure();
        raf = requestAnimationFrame(frame);
      } else if (!go && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      cv!.dataset.running = raf ? "true" : "false";
    };

    let mo: MutationObserver | null = null;
    const onScrollStill = () => still();
    if (reduce) {
      still(true);
      window.addEventListener("scroll", onScrollStill, { passive: true });
    } else {
      // the boot intro holds the page: no stream frames until it lets go
      mo = new MutationObserver(run);
      mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
      document.addEventListener("visibilitychange", run);
      run();
    }
    cv.dataset.on = "";

    return () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      window.clearInterval(remeasure);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScrollStill);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);

  return <canvas ref={ref} className="lime-stream" aria-hidden="true" />;
}

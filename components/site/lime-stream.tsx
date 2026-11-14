"use client";

import { useEffect, useRef } from "react";
import { position, velocity } from "@/lib/scroll";

// The lime stream (target docs/design/lime-stream.html, dimmer than its
// lowest setting): one fixed canvas 2D layer behind the whole page. A
// milky-way ribbon along a cubic spine whose shape is keyed per section and
// blended from the Lenis scroll value; scroll velocity drives its turbulence.
// Three layers: a low-res blurred haze, fine silk fibres and drifting star
// dust, creamy white at the core, lime in the body, cool blue at the edges.
// In the contact finale it is mirrored from both sides and converges into
// the core.
//
// The stream never visibly ends. Each frame, past both ends of the (blended)
// spine, the band continues straight along the end tangent until its whole
// width, twist and wave included, is outside the viewport, and only then
// fades out over the last ~13% of its length. The one end allowed on screen
// is the finale's, inside the core: the keyframe's `endIn` fades the far
// extension and the last 15% of the spine there.
//
// Text stays readable: the stream is cut back (destination-out, soft edges)
// behind headings, paragraphs and list text in the page flow; the panels
// over it are frosted glass.
//
// Canvas 2D, not WebGL: the page already runs up to three WebGL contexts
// (core + two scenes) and the budget allows no more. Measured (_r2/bench):
// 2D ~7ms a frame, an equivalent full-screen shader ~3-4ms but a fourth
// context; so 2D, at 30fps at rest and on phones, full rate while scrolling.
// Decorative only: aria-hidden, no pointer events, never on the critical path
// (lazy chunk, starts after the boot intro lets go of the page).

const INTENSITY = 0.07;
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
  /** 1: the spine's far end terminates on screen (inside the finale core) */
  endIn: number;
}

// cubic spine in viewport units, ribbon width, pinch point, mirrored twin
const KF: Record<Key, Shape> = {
  hero: { p: [[-0.15, 1.05], [0.3, 0.8], [0.52, 0.3], [1.15, -0.1]], w: 0.42, pinch: 0.48, min: 0.05, mirror: 0, a: 1, endIn: 0 },
  projects: { p: [[-0.15, 0.15], [0.35, 0.05], [0.58, 0.95], [1.15, 0.72]], w: 0.36, pinch: 0.55, min: 0.05, mirror: 0, a: 0.9, endIn: 0 },
  stack: { p: [[-0.15, 0.88], [0.22, -0.2], [0.78, -0.2], [1.15, 0.92]], w: 0.3, pinch: 0.5, min: 0.08, mirror: 0, a: 1, endIn: 0 },
  experience: { p: [[0.2, 1.15], [0.42, 0.78], [0.66, 0.42], [0.8, -0.15]], w: 0.26, pinch: 0.62, min: 0.05, mirror: 0, a: 0.8, endIn: 0 },
  contact: { p: [[-0.15, 1.05], [0.12, 0.7], [0.34, 0.36], [0.5, 0.3]], w: 0.55, pinch: 1, min: 0, mirror: 1, a: 1, endIn: 1 },
};

/** where the tail fade starts on the spine when the end terminates on screen */
const TAIL = 0.85;
/** share of the band's length faded out at each far end */
const FADE = 0.13;
/** px kept clear outside the viewport, on top of the band's half-width */
const MARGIN = 24;
/** haze half line width (28) + its blur (2 x 10) + dust radius */
const HALO = 52;
/** the stream's own alpha under text: 1 - CUT */
const CUT = 0.82;
const TEXT_SEL = "main :is(h1, h2, h3, p, li, dt, dd)";
/** text inside these has its own frosted panel or moves on its own */
const TEXT_SKIP = ".cmd, .dock, .depth-stage, .jr-stage, .constel, .narrator, [aria-hidden='true']";

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
  /** -0.3..1.3: below 0 / above 1 runs along the end extensions */
  t: number;
  v: number;
  s: number;
  tw: number;
}
/** per-frame geometry of one ribbon's two end extensions (unflipped px) */
interface Ends {
  d0: [number, number];
  d1: [number, number];
  /** distance past the end at which the whole band is off screen */
  need0: number;
  need1: number;
  fade: number;
  /** alpha of the far end: 0 when it terminates in the core */
  k: number;
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
    endIn: lerp(A.endIn, B.endIn, f),
  };
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
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
const RGB = ["242,255,205", "200,245,66", "120,190,235"];
const tintOf = (o: number) => {
  const e = Math.min(1, Math.abs(o));
  return e < 0.22 ? 0 : e < 0.6 ? 1 : 2;
};
const tintGain = (i: number) => (i === 2 ? 0.85 : 1);
const SOLID = RGB.map((c) => `rgb(${c})`);

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
    const mc = document.createElement("canvas");
    const mctx = mc.getContext("2d");
    if (!hctx || !mctx) return;
    const HS = 0.22; // haze resolution scale
    const MS = 0.25; // text mask resolution scale
    const canFilter = "filter" in ctx;

    let W = 0;
    let H = 0;
    let small = false;
    const fibres: Fibre[] = [];
    const haze: Fibre[] = [];
    const dust: Dust[] = [];

    // section centres and text boxes in document px, re-measured on resize
    // and now and then (the depth and journey tracks size after hydration)
    let centres: { k: Key; c: number }[] = [];
    let texts: { x: number; y: number; w: number; h: number }[] = [];
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
      texts = [];
      document.querySelectorAll<HTMLElement>(TEXT_SEL).forEach((el) => {
        if (el.closest(TEXT_SKIP) || el.parentElement?.closest(TEXT_SEL)) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        texts.push({ x: r.left - 14, y: r.top + y - 10, w: r.width + 28, h: r.height + 20 });
      });
    };
    // the finale's spine ends in the core wherever the core is right now
    // (it scrolls up into place), so the end never shows beside it
    // the live core's slot, or the static core where the finale does not run
    const coreRect = () => {
      for (const el of document.querySelectorAll(".contact-core, .contact-still")) {
        const r = el.getBoundingClientRect();
        if (r.width) return r;
      }
      return null;
    };
    function followCore() {
      const xp = centres.find((c) => c.k === "experience");
      if (xp && position() + H / 2 < xp.c) return;
      const r = coreRect();
      if (!r) return;
      const cx = (r.left + r.width / 2) / W;
      const cy = (r.top + r.height / 2) / H;
      KF.contact.p = [
        [-0.15, Math.max(1.05, cy + 0.75)],
        [0.12, cy + 0.4],
        [cx - 0.16, cy + 0.06],
        [cx, cy],
      ];
    }
    function target(): Shape {
      if (!centres.length) return KF.hero;
      followCore();
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
      // spread over the extensions too (-0.3..1.3), so a few more
      for (let i = 0; i < (small ? 150 : 460); i++) {
        const f = fibre(0.5, 0.01);
        f.fr = 0.5 + Math.random();
        f.sp = 0.2;
        f.amp = 0.01;
        dust.push({ f, t: -0.3 + Math.random() * 1.6, v: 0.006 + Math.random() * 0.03, s: 0.5 + Math.random() * Math.random() * 2.2, tw: Math.random() * 6.28 });
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
      mc.width = Math.max(1, Math.round(W * MS));
      mc.height = Math.max(1, Math.round(H * MS));
      if (!fibres.length || wasSmall !== small) build();
      measure();
    }

    let cur = clone(KF.hero);
    let time = 0;
    const S = () => Math.min(W, H) * 1.15;

    // ---- geometry (unflipped px; flip mirrors x for the twin) ----
    function spine(P: Shape["p"], t: number): [number, number] {
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      return [(a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0]) * W, (a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]) * H];
    }
    function tangent(P: Shape["p"], t: number): [number, number] {
      const u = 1 - t;
      const x = (3 * u * u * (P[1][0] - P[0][0]) + 6 * u * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0])) * W;
      const y = (3 * u * u * (P[1][1] - P[0][1]) + 6 * u * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1])) * H;
      const l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    }
    const prof = (sh: Shape, t: number) => sh.min + (1 - sh.min) * Math.min(1, Math.pow(Math.abs(t - sh.pinch) * 2, 1.4));
    // a point on fibre f at t in 0..1 along the spine, offset across the band
    function point(sh: Shape, f: Fibre, t: number, turb: number, s: number, tm: number): [number, number] {
      const [x, y] = spine(sh.p, t);
      const [tx, ty] = tangent(sh.p, t);
      const twist = 0.7 + 0.3 * Math.cos(t * 1.6 - tm * 0.18 + f.o * 0.7);
      const wave = Math.sin(t * f.fr * 6.28 + tm * f.sp + f.ph) * (f.amp + turb * 0.02) * s;
      const off = sh.w * s * prof(sh, t) * f.o * twist + wave;
      return [x - ty * off, y + tx * off];
    }
    /**
     * how far past each end the band must run before all of it is off
     * screen: the end cap (perpendicular to the end tangent, at most the
     * full width plus wave and halo) moved along the tangent until both its
     * corners are beyond one viewport edge
     */
    function ends(sh: Shape, s: number): Ends {
      const need = (C: [number, number], d: [number, number], hw: number) => {
        const nx = Math.abs(d[1]) * hw;
        const ny = Math.abs(d[0]) * hw;
        // the halo reaches past the cap in every direction, not just sideways
        const m = MARGIN + HALO;
        let L = Infinity;
        if (d[0] < -1e-3) L = Math.min(L, (C[0] + nx + m) / -d[0]);
        if (d[0] > 1e-3) L = Math.min(L, (W + m - C[0] + nx) / d[0]);
        if (d[1] < -1e-3) L = Math.min(L, (C[1] + ny + m) / -d[1]);
        if (d[1] > 1e-3) L = Math.min(L, (H + m - C[1] + ny) / d[1]);
        return Math.max(0, L);
      };
      const hw = (t: number) => s * (sh.w * prof(sh, t) * 1.15 + 0.012 + 0.02) + HALO;
      const t0 = tangent(sh.p, 0);
      const t1 = tangent(sh.p, 1);
      const d0: [number, number] = [-t0[0], -t0[1]];
      const d1: [number, number] = [t1[0], t1[1]];
      const need0 = need(spine(sh.p, 0), d0, hw(0));
      const need1 = need(spine(sh.p, 1), d1, hw(1));
      let arc = 0;
      let prev = spine(sh.p, 0);
      for (let i = 1; i <= 16; i++) {
        const q = spine(sh.p, i / 16);
        arc += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        prev = q;
      }
      return { d0, d1, need0, need1, fade: (FADE / (1 - 2 * FADE)) * (arc + need0 + need1), k: 1 - smooth(0.7, 1, sh.endIn) };
    }
    /** alpha along the far-end extension at distance x past the end */
    const extAlpha = (x: number, need: number, fade: number) => (x <= need ? 1 : Math.max(0, 1 - (x - need) / fade));

    // ---- drawing ----
    function strokeRibbon(c: CanvasRenderingContext2D, list: Fibre[], sh: Shape, g: Ends, turb: number, flip: boolean, steps: number, style: (f: Fibre) => { a: number; w: number }) {
      const s = S();
      const X = (x: number) => (flip ? W - x : x);
      const grad = (A: [number, number], B: [number, number], a0: number, a1: number) =>
        RGB.map((rgb) => {
          const gr = c.createLinearGradient(X(A[0]), A[1], X(B[0]), B[1]);
          gr.addColorStop(0, `rgba(${rgb},${a0})`);
          gr.addColorStop(1, `rgba(${rgb},${a1})`);
          return gr;
        });
      const C0 = spine(sh.p, 0);
      const C1 = spine(sh.p, 1);
      const at = (C: [number, number], d: [number, number], x: number): [number, number] => [C[0] + d[0] * x, C[1] + d[1] * x];
      // extension gradients run along the end tangent, so they line up for
      // every fibre (fibre offsets at the ends are perpendicular to it)
      const G0 = grad(at(C0, g.d0, g.need0 + g.fade), at(C0, g.d0, g.need0), 0, 1);
      const G1 = g.k > 0.01 ? grad(at(C1, g.d1, g.need1), at(C1, g.d1, g.need1 + g.fade), g.k, 0) : null;
      const tail = g.k < 0.999;
      const GT = tail ? grad(spine(sh.p, TAIL), C1, 1, g.k) : null;
      const bodyEnd = tail ? Math.round(steps * TAIL) : steps;
      for (const f of list) {
        const { a, w } = style(f);
        if (a <= 0) continue;
        const ti = tintOf(f.o);
        c.globalAlpha = Math.min(1, a * tintGain(ti));
        c.lineWidth = w;
        const p0 = point(sh, f, 0, turb, s, time);
        const p1 = point(sh, f, 1, turb, s, time);
        // start extension, fading in from far off screen
        c.strokeStyle = G0[ti];
        c.beginPath();
        c.moveTo(X(p0[0] + g.d0[0] * (g.need0 + g.fade)), p0[1] + g.d0[1] * (g.need0 + g.fade));
        c.lineTo(X(p0[0]), p0[1]);
        c.stroke();
        // the spine
        c.strokeStyle = SOLID[ti];
        c.beginPath();
        c.moveTo(X(p0[0]), p0[1]);
        for (let i = 1; i <= bodyEnd; i++) {
          const [x, y] = point(sh, f, i / steps, turb, s, time);
          c.lineTo(X(x), y);
        }
        c.stroke();
        if (GT) {
          c.strokeStyle = GT[ti];
          c.beginPath();
          for (let i = bodyEnd; i <= steps; i++) {
            const [x, y] = point(sh, f, i / steps, turb, s, time);
            if (i === bodyEnd) c.moveTo(X(x), y);
            else c.lineTo(X(x), y);
          }
          c.stroke();
        }
        // far extension, fading out off screen (or gone: ends in the core)
        if (G1) {
          c.strokeStyle = G1[ti];
          c.beginPath();
          c.moveTo(X(p1[0]), p1[1]);
          c.lineTo(X(p1[0] + g.d1[0] * (g.need1 + g.fade)), p1[1] + g.d1[1] * (g.need1 + g.fade));
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    }

    /** a dust mote's position and alpha factor along the extended band */
    function mote(sh: Shape, g: Ends, d: Dust, turb: number, s: number): [number, number, number] {
      if (d.t < 0) {
        const p = point(sh, d.f, 0, turb, s, time);
        const x = (-d.t / 0.3) * (g.need0 + g.fade);
        return [p[0] + g.d0[0] * x, p[1] + g.d0[1] * x, extAlpha(x, g.need0, g.fade)];
      }
      if (d.t > 1) {
        const p = point(sh, d.f, 1, turb, s, time);
        const x = ((d.t - 1) / 0.3) * (g.need1 + g.fade);
        return [p[0] + g.d1[0] * x, p[1] + g.d1[1] * x, g.k * extAlpha(x, g.need1, g.fade)];
      }
      const p = point(sh, d.f, d.t, turb, s, time);
      return [p[0], p[1], d.t > TAIL ? lerp(1, g.k, (d.t - TAIL) / (1 - TAIL)) : 1];
    }

    function ribbon(turb: number, flip: boolean, am: number) {
      const k = INTENSITY * am * cur.a;
      const s = S();
      const g = ends(cur, s);
      // 1. haze: thick at low resolution, scaled up and blurred
      hctx!.setTransform(HS, 0, 0, HS, 0, 0);
      hctx!.globalCompositeOperation = "source-over";
      hctx!.clearRect(0, 0, W, H);
      hctx!.globalCompositeOperation = "lighter";
      hctx!.lineCap = "butt";
      strokeRibbon(hctx!, haze, cur, g, turb, flip, 28, (f) => {
        const c = 1 - Math.min(1, Math.abs(f.o));
        return { a: (0.05 + 0.1 * c) * k, w: 26 + 30 * c };
      });
      if (canFilter) ctx!.filter = "blur(10px)";
      ctx!.drawImage(hc, 0, 0, W, H);
      if (canFilter) ctx!.filter = "none";
      // 2. silk: many fine, faint fibres, dense in the middle
      strokeRibbon(ctx!, fibres, cur, g, turb, flip, small ? 32 : 48, (f) => {
        const c = 1 - Math.min(1, Math.abs(f.o));
        return { a: (0.012 + 0.07 * c * c) * k, w: f.w };
      });
      // 3. star dust drifting through the band
      for (const d of dust) {
        const [x, y, fa] = mote(cur, g, d, turb, s);
        if (fa <= 0.01 || x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.2 + d.tw));
        const ti = tintOf(d.f.o * 0.6);
        ctx!.fillStyle = `rgba(${RGB[ti]},${0.55 * tw * k * fa * tintGain(ti)})`;
        ctx!.beginPath();
        ctx!.arc(flip ? W - x : x, y, d.s, 0, 6.283);
        ctx!.fill();
      }
    }

    // cut the stream back behind text (soft edges from the low-res mask)
    function maskText() {
      const y = position();
      mctx!.setTransform(MS, 0, 0, MS, 0, 0);
      mctx!.clearRect(0, 0, W, H);
      mctx!.fillStyle = `rgba(0,0,0,${CUT})`;
      mctx!.beginPath();
      let any = false;
      for (const r of texts) {
        const top = r.y - y;
        if (top > H || top + r.h < 0) continue;
        mctx!.rect(r.x, top, r.w, r.h);
        any = true;
      }
      if (!any) return;
      if (canFilter) mctx!.filter = "blur(2px)";
      mctx!.fill();
      if (canFilter) mctx!.filter = "none";
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.drawImage(mc, 0, 0, W, H);
    }

    function draw(turb: number, dt: number) {
      ctx!.globalCompositeOperation = "source-over";
      ctx!.clearRect(0, 0, W, H);
      for (const d of dust) {
        d.t += d.v * dt * (1 + turb * 2);
        if (d.t > 1.3) d.t -= 1.6;
      }
      ctx!.globalCompositeOperation = "lighter";
      ribbon(turb, false, 1);
      if (cur.mirror > 0.02) ribbon(turb, true, cur.mirror);
      maskText();
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
      if (k === shown && !force && k !== "contact") return;
      shown = k;
      followCore();
      cur = clone(KF[k]);
      time = 0;
      draw(0, 0);
      cv!.dataset.frame = k;
    }

    let raf = 0;
    let last = 0;
    let vel = 0;
    let lastY = -1;
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
      // text boxes are cached in page px; a long jump re-measures them now
      // instead of waiting for the periodic pass
      const y = position();
      if (Math.abs(y - lastY) > H * 3) measure();
      lastY = y;
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

    // test hook (_r2/stream.mjs, only with ?stream-check): every fibre's
    // visible end (where its alpha drops below 10%) at the settled shape for
    // the current scroll, over a few times at full turbulence
    if (new URLSearchParams(window.location.search).has("stream-check")) {
      (window as unknown as { __streamEnds: () => unknown }).__streamEnds = () => {
        measure();
        const sh = target();
        const s = S();
        const g = ends(sh, s);
        const out: { x: number; y: number; r: number; end: number; mirror: boolean }[] = [];
        const T = 0.1;
        for (const flip of [false, true]) {
          const am = flip ? sh.mirror : 1;
          if (am < T) continue;
          for (const tm of [0, 7, 19, 41]) {
            for (const [list, rad] of [[fibres, 2], [haze, 56 / 2 + 20]] as const) {
              for (const f of list) {
                // start: alpha reaches T at need0 + fade * (1 - T / am)
                const p0 = point(sh, f, 0, 1, s, tm);
                const x0 = g.need0 + g.fade * (1 - T / am);
                const e0: [number, number] = [p0[0] + g.d0[0] * x0, p0[1] + g.d0[1] * x0];
                // far end: along the extension while it is visible, else in the tail
                let e1: [number, number];
                if (g.k * am >= T) {
                  const p1 = point(sh, f, 1, 1, s, tm);
                  const x1 = g.need1 + g.fade * (1 - T / (g.k * am));
                  e1 = [p1[0] + g.d1[0] * x1, p1[1] + g.d1[1] * x1];
                } else {
                  const tt = Math.min(1, TAIL + (1 - TAIL) * ((1 - T / am) / (1 - g.k)));
                  e1 = point(sh, f, tt, 1, s, tm);
                }
                for (const [e, end] of [[e0, 0], [e1, 1]] as const) {
                  out.push({ x: flip ? W - e[0] : e[0], y: e[1], r: rad, end, mirror: flip });
                }
              }
            }
          }
        }
        return { W, H, ends: out };
      };
    }

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

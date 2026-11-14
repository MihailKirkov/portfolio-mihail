"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ContextLoss, Loop, cssColor } from "@/components/core/r3f-shared";
import { onScroll, velocity as scrollVelocity } from "@/lib/scroll";

// The projects depth scene: one R3F canvas behind the depth stage's DOM (rail,
// info panel, invisible slab hit boxes). It loads in its own chunk behind
// components/projects/depth-stage.tsx, which decides whether it runs at all
// and keeps the CSS slabs as the placeholder and fallback.
//
// Technique adapted from Houmahani Kane's "Scroll-Reactive 3D Gallery"
// (Codrops, March 2026; github.com/houmahani/codrops-depth-gallery, MIT):
//   - each project is a textured plane (its first gallery image) on its own
//     Z layer, PLANE_GAP apart; the camera travels through them
//   - a smoothed scroll velocity drives the planes' "breath" (tilt toward the
//     pointer + a small scale pulse) and "drift" (planes trail the scroll
//     direction), plus a slight lift of the background
//   - a full-screen mood shader: a ground colour, two slow soft blobs and
//     grain, blended from one project's palette to the next by depth
// What differs here: the page scrolls through its one scroll source
// (lib/scroll.ts, Lenis on a fine pointer), not a wheel hijack. The stage's
// progress from that scroll, with its hold at every stop, is the camera's
// position (driver.cam), unsmoothed; the scroll's velocity drives breath and
// drift. At a stop
// the front plane sits exactly on the DOM slab's box, so clicks, the agent
// cursor and its outline land on the image. Palettes are sampled from each
// image at load and muted to near-ground darks.

export interface DepthDriver {
  /** camera position in project units, with the stage's hold at each stop */
  cam: number;
  /** the stage's front project (the panel and the rail show it) */
  front: number;
  /** the front index the scene last drew with (set by the scene) */
  drawn?: number;
  /** filter_projects: the chapter is dimmed */
  dimmed: boolean[];
}

export interface DepthGLProps {
  /** first gallery image per project (null: a plain panel) */
  images: (string | null)[];
  driver: RefObject<DepthDriver>;
  /** the front slab's box at rest: the front plane is laid over it */
  slot: () => HTMLElement | null;
  /** render only while true (section on screen, tab visible) */
  active: boolean;
  /** pointer parallax and tilt (fine pointer only) */
  pointer: boolean;
  /** textures are in and the first frame has rendered */
  onReady: () => void;
  onLost: () => void;
}

const FOV = 32;
/** camera distance to the front plane at a stop, world units */
const REST = 3;
const PLANE_GAP = 3.2;
/** texture width requested from the image optimizer, px */
const TEX_W = 1200;
/** |scroll velocity| at which breath and drift saturate, px per frame */
const V_MAX = 40;

// ---- moods: palettes sampled from the images, muted to the dark identity ----

interface Mood {
  bg: THREE.Color;
  blob1: THREE.Color;
  blob2: THREE.Color;
}

function neutralMood(): Mood {
  const g = cssColor("--ground", "#0a0b0d");
  const p = cssColor("--panel", "#111317");
  return {
    bg: new THREE.Color(g.x, g.y, g.z),
    blob1: new THREE.Color(p.x, p.y, p.z).multiplyScalar(1.6),
    blob2: new THREE.Color(p.x, p.y, p.z).multiplyScalar(1.3),
  };
}

/**
 * Sample the image small, find its two strongest hues (weighted by chroma)
 * and rebuild them as dark, low-saturation colours: the background just above
 * the page ground, the blobs a step lighter. A greyscale screenshot gives a
 * near-neutral mood; a colourful one only tints the dark.
 */
function moodOf(img: CanvasImageSource): Mood {
  const N = 32;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return neutralMood();
  ctx.drawImage(img, 0, 0, N, N);
  const data = ctx.getImageData(0, 0, N, N).data;

  const BINS = 12;
  const weight = new Float32Array(BINS);
  const sx = new Float32Array(BINS);
  const sy = new Float32Array(BINS);
  let chromaSum = 0;
  let coloured = 0;
  const hsl = { h: 0, s: 0, l: 0 };
  const px = new THREE.Color();
  for (let i = 0; i < data.length; i += 4) {
    px.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
    px.getHSL(hsl, THREE.SRGBColorSpace);
    const chroma = hsl.s * (1 - Math.abs(2 * hsl.l - 1));
    if (chroma > 0.08) {
      chromaSum += chroma;
      coloured++;
    }
    const b = Math.floor(hsl.h * BINS) % BINS;
    weight[b] += chroma;
    sx[b] += Math.cos(hsl.h * Math.PI * 2) * chroma;
    sy[b] += Math.sin(hsl.h * Math.PI * 2) * chroma;
  }
  const hueOf = (b: number) => {
    const a = Math.atan2(sy[b], sx[b]) / (Math.PI * 2);
    return a < 0 ? a + 1 : a;
  };
  let b1 = 0;
  for (let b = 1; b < BINS; b++) if (weight[b] > weight[b1]) b1 = b;
  let b2 = -1;
  for (let b = 0; b < BINS; b++) {
    const dist = Math.min(Math.abs(b - b1), BINS - Math.abs(b - b1));
    if (dist >= 2 && (b2 < 0 || weight[b] > weight[b2])) b2 = b;
  }
  const total = weight.reduce((a, w) => a + w, 0) || 1;
  const h1 = weight[b1] > 0 ? hueOf(b1) : 0.6;
  const h2 = b2 >= 0 && weight[b2] > total * 0.08 ? hueOf(b2) : (h1 + 0.1) % 1;
  // how colourful the image is overall, 0..1; drives every saturation
  const share = coloured / (N * N);
  const colourful = coloured ? Math.min(1, (chromaSum / coloured) * Math.min(1, share * 6) * 1.6) : 0;

  const make = (h: number, s: number, l: number) =>
    new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
  return {
    bg: make(h1, 0.12 + 0.3 * colourful, 0.07),
    blob1: make(h1, 0.2 + 0.45 * colourful, 0.24),
    blob2: make(h2, 0.15 + 0.4 * colourful, 0.17),
  };
}

// ---- GLSL -----------------------------------------------------------------------

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // a full-screen quad in clip space, drawn first, behind everything
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
// 0.8: the stream behind shows at a fifth, never over the images
const float BG_ALPHA = 0.8;
uniform vec3 uBg;
uniform vec3 uBlob1;
uniform vec3 uBlob2;
uniform vec3 uGround;
uniform float uTime;
uniform float uBreath;
uniform float uAspect;
uniform vec2 uFocus;
varying vec2 vUv;

// hash without sine (Dave Hoskins): no banding at large pixel coordinates
float random(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  // blob 1 sits behind the front image, blob 2 drifts on the far side
  vec2 c1 = vec2((uFocus.x + 0.06 * sin(uTime * 0.13)) * uAspect, uFocus.y + 0.08 * cos(uTime * 0.11));
  vec2 c2 = vec2((1.0 - uFocus.x * 0.7 + 0.08 * cos(uTime * 0.09)) * uAspect, 0.22 + 0.1 * sin(uTime * 0.07));
  float r = 0.85 + 0.06 * uBreath;
  float b1 = smoothstep(r, 0.0, distance(p, c1));
  float b2 = smoothstep(r * 0.78, 0.0, distance(p, c2));

  vec3 color = uBg;
  float strength = 0.85 + 0.15 * uBreath;
  color = mix(color, mix(uBlob1, uBg, 0.35), b1 * strength);
  color = mix(color, mix(uBlob2, uBg, 0.35), b2 * strength);
  // velocity lifts the scene a touch on a fast scroll
  color += uBreath * 0.025;
  // the stage meets the page ground with no seam, top and bottom
  float edge = smoothstep(0.0, 0.14, vUv.y) * smoothstep(0.0, 0.1, 1.0 - vUv.y);
  color = mix(uGround, color, edge);
  // film grain
  color += (random(gl_FragCoord.xy + floor(uTime * 24.0) * vec2(17.0, 31.0)) - 0.5) * 0.02;
  // a little see-through, premultiplied: the lime stream reads faintly behind
  gl_FragColor = vec4(color * BG_ALPHA, BG_ALPHA);
}
`;

const PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLANE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uOpacity;
uniform float uTint;
uniform vec2 uCover;
uniform vec2 uPx;
uniform vec3 uGround;
uniform vec3 uPanel;
uniform vec3 uBorder;
varying vec2 vUv;

void main() {
  // object-fit: cover, centred
  vec2 uv = (vUv - 0.5) * uCover + 0.5;
  vec3 color = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : uPanel;
  // depth tint and filter dim: toward the ground, never see-through
  color = mix(color, uGround, uTint);
  // the slab's 1px border
  vec2 e = min(vUv, 1.0 - vUv) / uPx;
  color = mix(color, uBorder, step(min(e.x, e.y), 1.0));
  gl_FragColor = vec4(color, uOpacity);
}
`;

// ---- layout ---------------------------------------------------------------------

/** the front slab's box relative to the canvas, CSS px */
interface Layout {
  cw: number;
  ch: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function useSlotLayout(slot: () => HTMLElement | null) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const layout = useRef<Layout>({ cw: 0, ch: 0, x: 0, y: 0, w: 0, h: 0 });
  useEffect(() => {
    const canvas = gl.domElement;
    const measure = () => {
      const s = slot();
      if (!s) return;
      const c = canvas.getBoundingClientRect();
      // the slab's layout box, untransformed: its offset inside its
      // positioned parent (the CSS slabs may still be mid-move)
      const parent = s.offsetParent as HTMLElement | null;
      if (!parent) return;
      const pr = parent.getBoundingClientRect();
      const w = s.offsetWidth;
      const h = s.offsetHeight;
      const x = pr.left + s.offsetLeft - c.left;
      const y = pr.top + s.offsetTop - c.top;
      layout.current = { cw: c.width, ch: c.height, x, y, w, h };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    const s = slot();
    if (s) ro.observe(s);
    if (s?.parentElement) ro.observe(s.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gl, slot, size]);
  return layout;
}

// ---- the scene -----------------------------------------------------------------

/**
 * composition, in plane widths/heights: the planes climb and alternate sides,
 * so the next two peek out above the front one's corners instead of hiding
 * behind it; the camera follows the same path
 */
const STEP_X = 0.2;
const STEP_Y = 0.9;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (cur: number, to: number, rate: number, dt: number) =>
  cur + (to - cur) * (1 - Math.exp(-rate * dt));

function Scene({
  images,
  driver,
  slot,
  pointerRef,
  onReady,
}: {
  images: (string | null)[];
  driver: RefObject<DepthDriver>;
  slot: () => HTMLElement | null;
  pointerRef: RefObject<{ x: number; y: number }>;
  onReady: () => void;
}) {
  const n = images.length;
  const layout = useSlotLayout(slot);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const [loaded, setLoaded] = useState<{ tex: (THREE.Texture | null)[]; moods: Mood[] } | null>(
    null
  );
  const readySent = useRef(false);

  const colors = useMemo(
    () => ({
      ground: cssColor("--ground", "#0a0b0d"),
      panel: cssColor("--panel", "#111317"),
      border: cssColor("--border", "#3a3f47"),
    }),
    []
  );

  const bg = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uBg: { value: new THREE.Color() },
          uBlob1: { value: new THREE.Color() },
          uBlob2: { value: new THREE.Color() },
          uGround: { value: colors.ground },
          uTime: { value: 0 },
          uBreath: { value: 0 },
          uAspect: { value: 1 },
          uFocus: { value: new THREE.Vector2(0.5, 0.5) },
        },
      }),
    [colors]
  );

  const planes = useMemo(
    () =>
      images.map(
        () =>
          new THREE.ShaderMaterial({
            vertexShader: PLANE_VERT,
            fragmentShader: PLANE_FRAG,
            transparent: true,
            depthWrite: false,
            uniforms: {
              uMap: { value: null },
              uHasMap: { value: 0 },
              uOpacity: { value: 0 },
              uTint: { value: 0 },
              uCover: { value: new THREE.Vector2(1, 1) },
              uPx: { value: new THREE.Vector2(0.002, 0.003) },
              uGround: { value: colors.ground },
              uPanel: { value: colors.panel },
              uBorder: { value: colors.border },
            },
          })
      ),
    [images, colors]
  );
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  // textures at a sensible size through the image optimizer; a failed image
  // leaves a plain panel and a neutral mood
  useEffect(() => {
    let disposed = false;
    const loader = new THREE.TextureLoader();
    Promise.all(
      images.map((src) =>
        src
          ? loader
              .loadAsync(`/_next/image?url=${encodeURIComponent(src)}&w=${TEX_W}&q=70`)
              .catch(() => null)
          : Promise.resolve(null)
      )
    ).then((tex) => {
      if (disposed) {
        tex.forEach((t) => t?.dispose());
        return;
      }
      const moods = tex.map((t) => (t?.image ? moodOf(t.image as CanvasImageSource) : neutralMood()));
      tex.forEach((t) => {
        if (!t) return;
        // raw image values straight to the sRGB canvas, like the CSS slab
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = 4;
        t.needsUpdate = true;
      });
      setLoaded({ tex, moods });
    });
    return () => {
      disposed = true;
    };
  }, [images, camera]);

  useEffect(() => {
    if (!loaded) return;
    loaded.tex.forEach((t, i) => {
      const u = planes[i].uniforms;
      u.uMap.value = t;
      u.uHasMap.value = t ? 1 : 0;
    });
    return () => loaded.tex.forEach((t) => t?.dispose());
  }, [loaded, planes]);

  useEffect(
    () => () => {
      bg.dispose();
      planes.forEach((m) => m.dispose());
      quad.dispose();
    },
    [bg, planes, quad]
  );

  // motion state, eased per frame
  const m = useRef({ breath: 0, drift: 0, px: 0, py: 0, tint: [] as number[] });
  const mood = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color() }), []);

  useFrame((state, delta) => {
    const L = layout.current;
    const d = driver.current;
    if (!L.ch || !L.h || !d) return;
    const dt = Math.min(Math.max(delta, 1 / 240), 0.05);
    const s = m.current;

    // the page scroll's own velocity (Lenis, or native); breath and drift
    // keep the tutorial's easing, nothing else smooths the scroll
    const vel = Math.max(-V_MAX, Math.min(V_MAX, scrollVelocity()));
    s.breath = damp(s.breath, Math.min(1, (Math.abs(vel) / V_MAX) * 1.1), 8, dt);
    s.drift = damp(s.drift, vel / V_MAX, 3, dt);
    const ptr = pointerRef.current;
    s.px = damp(s.px, ptr?.x ?? 0, 5, dt);
    s.py = damp(s.py, ptr?.y ?? 0, 5, dt);

    // world size of one CSS px at the rest distance, and the slab's box there
    const span = 2 * REST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const wpp = span / L.ch;
    const pw = L.w * wpp;
    const ph = L.h * wpp;
    const offX = (L.x + L.w / 2 - L.cw / 2) * wpp;
    const offY = -(L.y + L.h / 2 - L.ch / 2) * wpp;
    const baseX = (i: number) => (i % 2 ? STEP_X : -STEP_X) * pw * (i ? 1 : 0);
    const baseY = (i: number) => i * STEP_Y * ph;

    // the camera: the front plane on the slab's box at every stop
    const cam = Math.min(Math.max(d.cam, 0), n - 1);
    const k = Math.min(Math.floor(cam), Math.max(0, n - 2));
    const t = cam - k;
    const k1 = Math.min(k + 1, n - 1);
    camera.position.set(
      THREE.MathUtils.lerp(baseX(k), baseX(k1), t) - offX,
      THREE.MathUtils.lerp(baseY(k), baseY(k1), t) - offY,
      -cam * PLANE_GAP + REST
    );
    camera.updateMatrixWorld();

    // the planes; the nearest drawn one is the front, reported on the canvas
    // for npm run test:projects (it must match the stage's panel and rail)
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const u = planes[i].uniforms;
      const z = -i * PLANE_GAP;
      const dist = camera.position.z - z;
      let opacity: number;
      let tint: number;
      // keyed on the transition's midpoint, where the stage switches the
      // panel and the rail: the outgoing plane is gone and the incoming one
      // fully lit exactly there
      if (dist < REST) {
        const out = (REST - dist) / PLANE_GAP;
        opacity = 1 - smoothstep(0.2, 0.5, out);
        tint = 0;
      } else {
        const e = (dist - REST) / PLANE_GAP;
        opacity = Math.min(1, Math.max(0, 3 - e));
        tint = e <= 1 ? 0.7 * smoothstep(0.5, 1, e) : 0.7 + 0.15 * Math.min(1, e - 1);
      }
      s.tint[i] = damp(s.tint[i] ?? 0, d.dimmed[i] ? 0.75 : 0, 6, dt);
      u.uOpacity.value = opacity;
      u.uTint.value = Math.max(tint, s.tint[i]);
      // drawn by the stage's own front index, the one the panel and the rail
      // use: planes already passed are gone, the front one stays drawn until
      // the stage switches (its fade is near zero just before: without this
      // it would vanish a hair early, at u ~0.49 instead of 0.5)
      mesh.visible =
        i >= d.front && dist > 0.05 && (i === d.front || opacity > 0.004);
      if (!mesh.visible) continue;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }

      // tutorial motion: parallax (pointer), drift (scroll direction), breath (speed)
      const influence = opacity * (1 + i * 0.05);
      const breath = s.breath * opacity;
      mesh.position.set(
        baseX(i) + s.px * 0.025 * pw * influence,
        baseY(i) + s.py * 0.02 * ph * influence + s.drift * 0.05 * ph,
        z
      );
      mesh.rotation.set(
        -s.py * 0.05 * breath + s.drift * 0.04 * opacity,
        s.px * 0.05 * breath,
        0
      );
      const pulse = 1 + 0.03 * breath;
      mesh.scale.set(pw * pulse, ph * pulse, 1);
      mesh.renderOrder = n - i;

      // cover fit and a 1px border at rest
      const tex = u.uMap.value as THREE.Texture | null;
      const img = tex?.image as { width?: number; height?: number } | undefined;
      const ia = img?.width && img?.height ? img.width / img.height : pw / ph;
      const pa = pw / ph;
      (u.uCover.value as THREE.Vector2).set(ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
      (u.uPx.value as THREE.Vector2).set(1 / L.w, 1 / L.h);
    }

    d.drawn = d.front;
    const canvas = state.gl.domElement;
    if (canvas.dataset.front !== String(nearest)) canvas.dataset.front = String(nearest);

    // the mood: current palette toward the next, by depth
    const moods = loaded?.moods;
    const bu = bg.uniforms;
    if (moods) {
      const ma = moods[k];
      const mb = moods[k1];
      const blend = smoothstep(0, 1, t);
      (bu.uBg.value as THREE.Color).copy(mood.a.copy(ma.bg)).lerp(mood.b.copy(mb.bg), blend);
      (bu.uBlob1.value as THREE.Color).copy(mood.a.copy(ma.blob1)).lerp(mood.b.copy(mb.blob1), blend);
      (bu.uBlob2.value as THREE.Color).copy(mood.a.copy(ma.blob2)).lerp(mood.b.copy(mb.blob2), blend);
    }
    bu.uTime.value = state.clock.elapsedTime;
    bu.uBreath.value = s.breath;
    bu.uAspect.value = L.cw / L.ch;
    (bu.uFocus.value as THREE.Vector2).set((L.x + L.w / 2) / L.cw, 1 - (L.y + L.h / 2) / L.ch);

    if (loaded && !readySent.current) {
      readySent.current = true;
      // after this frame is on screen
      requestAnimationFrame(() => onReady());
    }
  });

  return (
    <>
      <mesh geometry={quad} material={bg} renderOrder={-1000} frustumCulled={false} />
      {images.map((src, i) => (
        <mesh
          key={`${i}:${src}`}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={quad}
          material={planes[i]}
          visible={false}
        />
      ))}
    </>
  );
}

/**
 * The scene draws on its own frame loop, which can run before the page's
 * scroll handler in a frame: it would then show the previous front project
 * for a frame after the panel and the rail have switched. When the stage's
 * front index changes, draw again at once, in the same frame (after every
 * scroll listener, so the stage has updated the driver). Also while the loop
 * is paused: a jump back into the section would otherwise show the last
 * frame drawn, from wherever the stage was left, until the loop resumes.
 */
function FrontSync({ driver }: { driver: RefObject<DepthDriver> }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let queued = false;
    return onScroll(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        const d = driver.current;
        if (d && d.drawn !== d.front) advance(performance.now() / 1000);
      });
    });
  }, [advance, driver]);
  return null;
}

export function DepthGL({ images, driver, slot, active, pointer, onReady, onLost }: DepthGLProps) {
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!pointer) return;
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      pointerRef.current.x = pointerRef.current.y = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [pointer]);

  return (
    <Canvas
      frameloop="never"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance", stencil: false }}
      camera={{ position: [0, 0, REST], fov: FOV, near: 0.05, far: 40 }}
      resize={{ offsetSize: true, scroll: false, debounce: { scroll: 50, resize: 0 } }}
    >
      <Loop active={active} fps={0} />
      <FrontSync driver={driver} />
      <ContextLoss onLost={onLost} />
      <Scene images={images} driver={driver} slot={slot} pointerRef={pointerRef} onReady={onReady} />
    </Canvas>
  );
}

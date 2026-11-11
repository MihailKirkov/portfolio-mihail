"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { AgentStatus } from "@/lib/agent/store";

// The shader core: a faceted icosphere shell with three dashed orbits, on
// React Three Fiber (WebGLRenderer only). It loads in its own chunk behind
// components/core/core.tsx, which decides whether it runs at all and keeps
// the static SVG still (components/core/core-still.tsx) as the placeholder
// and fallback; the still is a render of this scene at idle, t = 0.
//
// One agent-state uniform, `uState`, drives the look: a vec3 of smoothed
// weights for idle / thinking / executing, eased from the agent status so a
// change reads as a transition, not a cut.
//   idle      grey edges, a slow turn, a breath, the orbits drifting
//   thinking  white edges, tumbling on two axes, a scan band racing down
//   executing accent edges, a lit sweep round the shell, the orbits swung
//             face-on as a reticle with their dashes travelling
// The pointer tilts the core, bulges it toward the pointer and brightens it
// as the pointer comes close (`uPointerDir`, `uNear`); both rest at neutral on
// touch devices and under reduced motion, where the gate never enables
// pointer input.
//
// Rendering is driven by our own requestAnimationFrame loop (frameloop
// "never"): it only runs while the core is on screen and the tab is visible,
// can be capped to a frame rate (docked), and its clock stops with it, so
// nothing jumps on resume.

export interface ShaderCoreProps {
  status: AgentStatus;
  /** pointer effects on (fine pointer, no reduced motion) */
  pointer: boolean;
  /** render only while true (on screen and the tab is visible) */
  active: boolean;
  /** frame-rate cap; 0 renders every frame */
  fps: number;
  /** the first frame has rendered */
  onReady: () => void;
  /** the WebGL context was lost: the gate falls back to the still */
  onLost: () => void;
}

// ---- colours from the CSS tokens, so --accent stays a one-line change ------

function cssColor(name: string, fallback: string): THREE.Vector3 {
  let hex = fallback;
  if (typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) hex = v;
  }
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  // the shaders write straight to the sRGB canvas, so the tokens stay as-is
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function palette() {
  return {
    uAccent: { value: cssColor("--accent", "#c8f542") },
    uText: { value: cssColor("--text", "#e8eaed") },
    uMuted: { value: cssColor("--muted", "#a3a9b3") },
    uBorder: { value: cssColor("--border", "#3a3f47") },
    uPanel: { value: cssColor("--panel", "#111317") },
    uGround: { value: cssColor("--ground", "#0a0b0d") },
  };
}

// ---- GLSL -----------------------------------------------------------------------

const NOISE = /* glsl */ `
// 3D simplex noise (Ashima Arts, MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec3 uState;      // idle, thinking, executing weights (sum ~1)
uniform float uSince;     // seconds since the status last changed
uniform vec3 uPointerDir; // view-space direction toward the pointer
uniform float uNear;      // 1 with the pointer on the core, 0 far from it
uniform vec3 uAccent, uText, uMuted, uBorder, uPanel, uGround;
`;

const SHELL_VERT = /* glsl */ `
${UNIFORMS}
attribute vec3 aBary;
varying vec3 vPos;
varying vec3 vViewN;
varying vec3 vBary;
${NOISE}
void main() {
  vec3 p = normalize(position);
  float think = uState.y;
  float exec = uState.z;
  float d = snoise(p * 2.2 + uTime * 1.6) * 0.07 * think;
  d += 0.06 * exec;
  // executing: the shell flexes in hard pulses
  d += 0.03 * exec * pow(0.5 + 0.5 * sin(uTime * 7.0 + p.y * 6.0), 8.0);
  // bulge toward the pointer when it is close
  vec3 vn = normalize(normalMatrix * p);
  float face = max(dot(vn, uPointerDir), 0.0);
  d += pow(face, 6.0) * uNear * 0.10;
  vPos = p;
  vViewN = vn;
  vBary = aBary;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p * (1.0 + d), 1.0);
}
`;

const SHELL_FRAG = /* glsl */ `
${UNIFORMS}
varying vec3 vPos;
varying vec3 vViewN;
varying vec3 vBary;
${NOISE}
// a fixed key light from the top left, in view space
float lambert() { return max(dot(normalize(vViewN), normalize(vec3(-0.5, 0.8, 0.6))), 0.0); }
float rim() { float f = 1.0 - max(dot(normalize(vViewN), vec3(0.0, 0.0, 1.0)), 0.0); return f * f; }
// the pointer's brightening: strongest on the side facing it
float toward() { return pow(max(dot(normalize(vViewN), uPointerDir), 0.0), 4.0) * uNear; }
void main() {
  float idle = uState.x, think = uState.y, exec = uState.z;
  // edges from the barycentric distance, anti-aliased
  float b = min(min(vBary.x, vBary.y), vBary.z);
  float w = fwidth(b);
  float edge = 1.0 - smoothstep(0.0, w * 1.6, b);

  // thinking: a band scanning down the shell, fast
  float band = smoothstep(0.75, 1.0, fract(-vPos.y * 0.6 - uTime * 1.4));
  float flicker = step(0.55, fract(snoise(floor(vPos * 4.0) * 1.7 + floor(uTime * 12.0))));
  // executing: a sweep around the axis lights the faces as it passes
  float ang = atan(vPos.z, vPos.x) / 6.2831853 + 0.5;
  float sweep = pow(fract(ang - uTime * 0.9), 6.0);

  vec3 edgeIdle = mix(uBorder, uMuted, 0.25 + 0.5 * rim());
  vec3 edgeThink = mix(uMuted, uText, 0.4 + 0.6 * band);
  vec3 edgeCol = edgeIdle * idle + edgeThink * think + uAccent * exec;
  edgeCol = mix(edgeCol, uText, toward() * 0.6);

  vec3 fill = mix(uGround, uPanel, 0.3 + 0.7 * lambert());
  fill = mix(fill, uPanel * 1.6, flicker * think * 0.5);
  fill = mix(fill, uAccent * 0.75, sweep * exec);
  fill = mix(fill, uPanel * 1.8, toward() * 0.5);

  float edgeAmt = edge * (0.55 + 0.45 * (think + exec) + band * think * 0.5);
  vec3 col = mix(fill, edgeCol, clamp(edgeAmt, 0.0, 1.0));
  // a brief flash as the agent starts executing
  col = mix(col, uText, exp(-uSince * 5.0) * exec * 0.35);
  gl_FragColor = vec4(col, 1.0);
}
`;

const RING_VERT = /* glsl */ `
uniform float uInner;
uniform float uOuter;
varying float vAngle;
varying float vRad;
void main() {
  vAngle = atan(position.y, position.x) / 6.2831853 + 0.5;
  vRad = (length(position.xy) - uInner) / (uOuter - uInner);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uState;
uniform float uDash;   // dashes around the ring
uniform float uSpin;   // dash travel, turns per second
uniform float uNear;
uniform vec3 uAccent, uText, uMuted, uBorder;
varying float vAngle;
varying float vRad;
void main() {
  float idle = uState.x, think = uState.y, exec = uState.z;
  // soft radial edges
  float e = min(vRad, 1.0 - vRad);
  float a = smoothstep(0.0, fwidth(vRad) * 1.5, e);
  // dashes of half the cell, travelling faster while the agent works
  float ph = fract(vAngle * uDash + uTime * uSpin * uDash * (0.2 + 1.5 * think + 0.8 * exec));
  a *= 1.0 - smoothstep(0.5, 0.58, abs(ph - 0.5) * 2.0);
  // thinking: the ring flickers in segments; executing: solid accent
  float seg = step(0.5, fract(vAngle * 6.0 + floor(uTime * 10.0) * 0.37));
  vec3 col = uBorder * idle + mix(uMuted, uText, seg) * think + uAccent * exec;
  col = mix(col, uText, uNear * 0.3 * (1.0 - exec));
  gl_FragColor = vec4(col, a * (0.9 * idle + think + exec));
}
`;

// ---- scene --------------------------------------------------------------------

interface RingSpec {
  radius: number;
  width: number;
  /** base tilt, radians, around x then y */
  tilt: [number, number];
  dash: number;
  spin: number;
  /** direction of the in-plane spin */
  dir: 1 | -1;
}

// mirrored in lib/core/still.ts
const RINGS: RingSpec[] = [
  { radius: 1.24, width: 0.012, tilt: [1.2, 0.2], dash: 24, spin: 0.08, dir: 1 },
  { radius: 1.42, width: 0.01, tilt: [0.5, -1.0], dash: 36, spin: 0.06, dir: -1 },
  { radius: 1.6, width: 0.008, tilt: [-0.9, 0.6], dash: 48, spin: 0.05, dir: 1 },
];

interface Shared {
  uTime: { value: number };
  uState: { value: THREE.Vector3 };
  uSince: { value: number };
  uPointerDir: { value: THREE.Vector3 };
  uNear: { value: number };
}

function Ring({ spec, shared, pal }: { spec: RingSpec; shared: Shared; pal: ReturnType<typeof palette> }) {
  const mesh = useRef<THREE.Mesh>(null);
  // built by hand: R3F's `uniforms` prop copies each uniform object, which
  // would detach the shared ones from the values the frame loop writes
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          ...shared,
          ...pal,
          uInner: { value: spec.radius - spec.width },
          uOuter: { value: spec.radius + spec.width },
          uDash: { value: spec.dash },
          uSpin: { value: spec.spin },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [shared, pal, spec]
  );
  useEffect(() => () => material.dispose(), [material]);
  const spinRef = useRef(0);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);
    const s = shared.uState.value;
    const t = shared.uTime.value;
    // idle: a slow turn; thinking: fast, wobbling; executing: the rings swing
    // round to face the viewer, a reticle, and spin steadily
    spinRef.current += d * spec.dir * (0.15 * s.x + 1.4 * s.y + 0.9 * s.z);
    const wobX = Math.sin(t * 2.3 + spec.radius) * 0.45 * s.y;
    const wobY = Math.cos(t * 1.9 + spec.radius * 2.0) * 0.45 * s.y;
    m.rotation.set((spec.tilt[0] + wobX) * (1 - s.z), (spec.tilt[1] + wobY) * (1 - s.z), spinRef.current);
  });

  return (
    <mesh ref={mesh} material={material}>
      <ringGeometry args={[spec.radius - spec.width, spec.radius + spec.width, 160]} />
    </mesh>
  );
}

/** the faceted shell: barycentric coordinates per face for the edge lines */
function shellGeometry() {
  // an icosahedron is non-indexed: every face has its own vertices, and
  // shared positions still displace alike, so no tears
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const n = geo.attributes.position.count;
  const bary = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) bary.set([1, 0, 0, 0, 1, 0, 0, 0, 1], i * 3);
  geo.setAttribute("aBary", new THREE.BufferAttribute(bary, 3));
  return geo;
}

const STATUS_INDEX: Record<AgentStatus, number> = { idle: 0, thinking: 1, executing: 2 };
const MAX_TILT = 0.24; // radians, about 14 degrees

interface PointerState {
  /** normalised window position, -0.5..0.5 */
  x: number;
  y: number;
  /** offset from the core's centre, in core radii */
  dx: number;
  dy: number;
  /** 1 with the pointer on the core, 0 beyond about 2.5 radii */
  near: number;
}

interface SceneProps {
  statusRef: RefObject<AgentStatus>;
  pointerRef: RefObject<PointerState>;
  onReady: () => void;
}

function Scene({ statusRef, pointerRef, onReady }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const readyRef = useRef(false);
  const lastStatus = useRef<AgentStatus>("idle");
  const sinceRef = useRef(0);
  const spin = useRef({ x: 0, y: 0 });
  const nearRef = useRef(0);

  const geometry = useMemo(shellGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const pal = useMemo(palette, []);
  const shared = useMemo<Shared>(
    () => ({
      uTime: { value: 0 },
      uState: { value: new THREE.Vector3(1, 0, 0) },
      uSince: { value: 0 },
      uPointerDir: { value: new THREE.Vector3(0, 0, 1) },
      uNear: { value: 0 },
    }),
    []
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: { ...shared, ...pal },
      }),
    [shared, pal]
  );
  useEffect(() => () => material.dispose(), [material]);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const d = Math.min(Math.max(dt, 0), 0.05);
    shared.uTime.value += d;

    // state weights ease toward the current status
    const status = statusRef.current;
    if (status !== lastStatus.current) {
      lastStatus.current = status;
      sinceRef.current = 0;
    }
    sinceRef.current += d;
    shared.uSince.value = sinceRef.current;
    target.set(0, 0, 0).setComponent(STATUS_INDEX[status], 1);
    shared.uState.value.lerp(target, 1 - Math.exp(-d * (status === "executing" ? 10 : 6)));
    const s = shared.uState.value;

    // pointer: tilt, direction and nearness (all rest when the pointer is off)
    const p = pointerRef.current;
    nearRef.current += (p.near - nearRef.current) * (1 - Math.exp(-d * 8));
    shared.uNear.value = nearRef.current;
    shared.uPointerDir.value.set(p.dx, -p.dy, 1.4).normalize();

    const g = group.current;
    if (g) {
      const k = 1 - Math.exp(-d * 6);
      g.rotation.x += (-p.y * MAX_TILT * 2 - g.rotation.x) * k;
      g.rotation.y += (p.x * MAX_TILT * 2 - g.rotation.y) * k;
      // breath: idle slow, thinking quick, executing a wider stance
      const t = shared.uTime.value;
      const breath = 1 + 0.012 * Math.sin(t * 1.2) * s.x + 0.03 * Math.sin(t * 6.0) * s.y + 0.05 * s.z;
      g.scale.setScalar(breath * (1 + nearRef.current * 0.04));
    }

    const m = shell.current;
    if (m) {
      // idle: a slow turn; thinking: tumbling on two axes; executing: a steady fast spin
      spin.current.y += d * (0.12 * s.x + 0.9 * s.y + 1.6 * s.z);
      spin.current.x += d * (0.02 * s.x + 0.7 * s.y);
      m.rotation.set(spin.current.x, spin.current.y, 0);
    }

    if (!readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  });

  return (
    <group ref={group}>
      <mesh ref={shell} geometry={geometry} material={material} />
      {RINGS.map((spec, i) => (
        <Ring key={i} spec={spec} shared={shared} pal={pal} />
      ))}
    </group>
  );
}

/**
 * our own frame loop: runs only while `active`, at most `fps` frames a second
 * when capped. A resize (docking) lifts the cap briefly so the canvas is
 * redrawn at its new size on the very next frame.
 */
function Loop({ active, fps }: { active: boolean; fps: number }) {
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

/** forwards a lost context to the gate, which falls back to the still */
function ContextLoss({ onLost }: { onLost: () => void }) {
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

export function ShaderCore({ status, pointer, active, fps, onReady, onLost }: ShaderCoreProps) {
  const statusRef = useRef<AgentStatus>(status);
  statusRef.current = status;
  const wrap = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, dx: 0, dy: 0, near: 0 });

  useEffect(() => {
    if (!pointer) return;
    const onMove = (e: PointerEvent) => {
      const el = wrap.current;
      const p = pointerRef.current;
      p.x = e.clientX / window.innerWidth - 0.5;
      p.y = e.clientY / window.innerHeight - 0.5;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const radius = r.width / 2 || 1;
      p.dx = (e.clientX - (r.left + r.width / 2)) / radius;
      p.dy = (e.clientY - (r.top + r.height / 2)) / radius;
      const dist = Math.hypot(p.dx, p.dy);
      p.near = 1 - Math.min(Math.max((dist - 0.9) / 1.6, 0), 1);
    };
    const onLeave = () => {
      pointerRef.current.near = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [pointer]);

  return (
    <div className="core-gl" ref={wrap}>
      <Canvas
        frameloop="never"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power", stencil: false }}
        camera={{ position: [0, 0, 6.4], fov: 30, near: 0.1, far: 20 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Loop active={active} fps={fps} />
        <ContextLoss onLost={onLost} />
        <Scene statusRef={statusRef} pointerRef={pointerRef} onReady={onReady} />
      </Canvas>
    </div>
  );
}

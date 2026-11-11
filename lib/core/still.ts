// A static render of the shader core in its idle state, as SVG path data.
// Server-only, computed once at build: the same icosphere three builds
// (IcosahedronGeometry(1, 3), the same subdivision), the same three dashed
// orbits, the same camera (fov 30 at z 6.4) and the same idle shading as
// components/core/shader-core.tsx at t = 0. It is the SSR placeholder and the
// permanent fallback, so the live core can crossfade in over it with no
// change of shape.
//
// Colours are the v3 tokens from globals.css. Idle never uses --accent.

const GROUND = "#0a0b0d";
const PANEL = "#111317";
const BORDER = "#3a3f47";
const MUTED = "#a3a9b3";

const FOV = 30;
const CAM_Z = 6.4;
/** viewBox size; the camera's visible half-height maps to VIEW / 2 */
const VIEW = 1000;
const DETAIL = 3;
const LIGHT = norm([-0.5, 0.8, 0.6]);

const RINGS: { radius: number; width: number; tilt: [number, number]; dash: number }[] = [
  { radius: 1.24, width: 0.012, tilt: [1.2, 0.2], dash: 24 },
  { radius: 1.42, width: 0.01, tilt: [0.5, -1.0], dash: 36 },
  { radius: 1.6, width: 0.008, tilt: [-0.9, 0.6], dash: 48 },
];

type V3 = [number, number, number];

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a: V3, b: V3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function lerp(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

const HALF = Math.tan((FOV / 2) * (Math.PI / 180));

function project([x, y, z]: V3): [number, number] {
  const d = (CAM_Z - z) * HALF;
  return [VIEW / 2 + (x / d) * (VIEW / 2), VIEW / 2 - (y / d) * (VIEW / 2)];
}

function hex(c: string): V3 {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function toHex(c: V3) {
  return (
    "#" +
    c
      .map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}
function mix(a: V3, b: V3, t: number): V3 {
  return lerp(a, b, t);
}

const ground = hex(GROUND);
const panel = hex(PANEL);
const border = hex(BORDER);
const muted = hex(MUTED);

// ---- the icosphere, as three's IcosahedronGeometry builds it ---------------

const T = (1 + Math.sqrt(5)) / 2;
const ICO_V: V3[] = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_I = [
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
  1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
  4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

function icosphere(detail: number): V3[][] {
  const faces: V3[][] = [];
  const cols = detail + 1;
  for (let f = 0; f < ICO_I.length; f += 3) {
    const a = ICO_V[ICO_I[f]];
    const b = ICO_V[ICO_I[f + 1]];
    const c = ICO_V[ICO_I[f + 2]];
    const v: V3[][] = [];
    for (let i = 0; i <= cols; i++) {
      v[i] = [];
      const aj = lerp(a, c, i / cols);
      const bj = lerp(b, c, i / cols);
      const rows = cols - i;
      for (let j = 0; j <= rows; j++) {
        v[i][j] = j === 0 && i === cols ? aj : lerp(aj, bj, j / rows);
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);
        if (j % 2 === 0) faces.push([v[i][k + 1], v[i + 1][k], v[i][k]]);
        else faces.push([v[i][k + 1], v[i + 1][k + 1], v[i + 1][k]]);
      }
    }
  }
  // onto the unit sphere
  return faces.map((tri) => tri.map(norm) as V3[]);
}

// ---- rings --------------------------------------------------------------------

/** three's default Euler order XYZ with z = 0: world = Rx(Ry(p)) */
function tilt([x, y, z]: V3, [rx, ry]: [number, number]): V3 {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = cy * x + sy * z;
  const y1 = y;
  const z1 = -sy * x + cy * z;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  return [x1, cx * y1 - sx * z1, sx * y1 + cx * z1];
}

/** is the straight line from the camera to q blocked by the unit sphere? */
function behindSphere(q: V3) {
  const o: V3 = [0, 0, CAM_Z];
  const d: V3 = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
  const a = dot(d, d);
  const b = 2 * dot(o, d);
  const c = dot(o, o) - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 && t < 1;
}

export interface StillPath {
  d: string;
  color: string;
  /** stroke width in viewBox units (rings only) */
  width?: number;
}

export interface CoreStillData {
  faces: StillPath[];
  edges: StillPath[];
  rings: StillPath[];
}

const px = (n: number) => Math.round(n).toString();
const pt = (p: V3) => project(p).map(px).join(" ");

function build(): CoreStillData {
  const tris = icosphere(DETAIL);
  const cam: V3 = [0, 0, CAM_Z];

  // faces: the shader's idle fill, mix(ground, panel, 0.3 + 0.7 * lambert),
  // quantised into a few levels so each level is one path
  const faceGroups = new Map<string, string[]>();
  const visible: V3[][] = [];
  for (const tri of tris) {
    const n = norm(add(add(tri[0], tri[1]), tri[2]));
    const toCam: V3 = [cam[0] - n[0], cam[1] - n[1], cam[2] - n[2]];
    if (dot(n, toCam) <= 0) continue;
    visible.push(tri);
    const lambert = Math.max(dot(n, LIGHT), 0);
    const level = Math.round(lambert * 4) / 4;
    const color = toHex(mix(ground, panel, 0.3 + 0.7 * level));
    const d = `M${pt(tri[0])}L${pt(tri[1])}L${pt(tri[2])}Z`;
    faceGroups.set(color, [...(faceGroups.get(color) ?? []), d]);
  }

  // edges of the visible faces, once each: the shader's idle edge colour,
  // mix(border, muted, 0.25 + 0.5 * rim), drawn at 55% over the fill
  const edgeGroups = new Map<string, string[]>();
  const seen = new Set<string>();
  const key = (p: V3) => p.map((v) => v.toFixed(4)).join(",");
  for (const tri of visible) {
    for (let i = 0; i < 3; i++) {
      const a = tri[i];
      const b = tri[(i + 1) % 3];
      const k = [key(a), key(b)].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      const n = norm(add(a, b));
      const rim = (1 - Math.max(n[2], 0)) ** 2;
      const lambert = Math.max(dot(n, LIGHT), 0);
      const fill = mix(ground, panel, 0.3 + 0.7 * lambert);
      const edge = mix(border, muted, 0.25 + 0.5 * rim);
      const level = Math.round(rim * 4) / 4;
      const color = toHex(mix(fill, mix(border, muted, 0.25 + 0.5 * level), 0.55));
      void edge;
      const d = `M${pt(a)}L${pt(b)}`;
      edgeGroups.set(color, [...(edgeGroups.get(color) ?? []), d]);
    }
  }

  // rings: dashes of half a cell (the ring shader at t = 0), hidden where the
  // sphere is in front; stroke width is the band's width at z = 0
  const rings: StillPath[] = RINGS.map((r) => {
    const parts: string[] = [];
    for (let i = 0; i < r.dash; i++) {
      let run: string[] = [];
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const vAngle = (i + 0.25 + (0.5 * s) / steps) / r.dash;
        const th = (vAngle - 0.5) * Math.PI * 2;
        const q = tilt([r.radius * Math.cos(th), r.radius * Math.sin(th), 0], r.tilt);
        if (behindSphere(q)) {
          if (run.length > 1) parts.push("M" + run.join("L"));
          run = [];
          continue;
        }
        run.push(pt(q));
      }
      if (run.length > 1) parts.push("M" + run.join("L"));
    }
    return {
      d: parts.join(""),
      color: BORDER,
      width: (2 * r.width * (VIEW / 2)) / (HALF * CAM_Z),
    };
  });

  return {
    faces: [...faceGroups].map(([color, ds]) => ({ color, d: ds.join("") })),
    edges: [...edgeGroups].map(([color, ds]) => ({ color, d: ds.join("") })),
    rings,
  };
}

let cached: CoreStillData | null = null;

/** the still's path data; built once per process */
export function coreStill(): CoreStillData {
  return (cached ??= build());
}

export const CORE_STILL_VIEW = VIEW;

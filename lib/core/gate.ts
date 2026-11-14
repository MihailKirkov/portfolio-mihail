import { prefersReducedMotion } from "@/lib/agent/choreo";

// The one WebGL gate, shared by every WebGL scene: the shader core
// (components/core/core.tsx, which is also the core shown in the journey),
// the projects depth scene (components/projects/depth-stage.tsx), the stack
// stage (components/stack/stack-stage.tsx) and the contact finale
// (components/site/finale.tsx). A scene runs only when it will run well.
//
// Before mount (canRunWebGL):
//   - not under reduced motion, not with data saver on
//   - a WebGL2 context, and not a software renderer (SwiftShader, llvmpipe,
//     Microsoft Basic Render, or one the browser flags as a major
//     performance caveat)
//   - navigator.hardwareConcurrency is only a hint: Brave randomises it per
//     site, and Safari and many laptops report 4. Only 2 or fewer rejects.
// After mount (startFrameProbe): the first scene to draw starts one probe
// for the page. It skips a few warm-up frames, then times ~30; if they
// average over 33ms (under 30fps) the gate closes for good and every scene
// subscribed with onDowngrade drops to its static fallback.
//
// The decision is on <html data-gl>: "on", "probing", or "off:<reason>",
// so it can be checked on a deployed build. ?gl=off forces the fallback.
// Callers add their own layout conditions (the core: not while hidden; the
// depth scene: only on the wide depth stage).

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
const WARMUP_FRAMES = 6;
const PROBE_FRAMES = 30;
const SLOW_FRAME_MS = 33;

let decided: { ok: boolean; reason: string } | null = null;
let downgraded = false;
let probe: "idle" | "running" | "done" = "idle";
const listeners = new Set<() => void>();

function mark(value: string) {
  document.documentElement.dataset.gl = value;
}

function inspectWebGL2(): { ok: boolean; reason: string } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) {
      // tell "no WebGL2" apart from "only a slow one"
      const any = document.createElement("canvas").getContext("webgl2");
      any?.getExtension("WEBGL_lose_context")?.loseContext();
      return { ok: false, reason: any ? "perf-caveat" : "no-webgl2" };
    }
    let renderer = "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "");
    // Firefox reports the real renderer here and deprecates the extension
    if (!renderer) renderer = String(gl.getParameter(gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (SOFTWARE.test(renderer)) return { ok: false, reason: "software" };
    return { ok: true, reason: "" };
  } catch {
    return { ok: false, reason: "no-webgl2" };
  }
}

function decide(): { ok: boolean; reason: string } {
  if (new URLSearchParams(location.search).get("gl") === "off") return { ok: false, reason: "forced" };
  if (prefersReducedMotion()) return { ok: false, reason: "reduced-motion" };
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return { ok: false, reason: "save-data" };
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return { ok: false, reason: "cores" };
  return inspectWebGL2();
}

export function canRunWebGL() {
  if (typeof window === "undefined") return false;
  if (downgraded) return false;
  // reduced motion can change while the page is open; the rest is fixed
  if (prefersReducedMotion()) return false;
  if (!decided) {
    decided = decide();
    if (probe === "idle") mark(decided.ok ? "on" : `off:${decided.reason}`);
  }
  return decided.ok;
}

/** called when the frame probe closes the gate; returns an unsubscribe */
export function onDowngrade(fn: () => void): () => void {
  if (downgraded) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Time the page's first frames once a scene is drawing. Once per page: later
 * calls do nothing. Frames in a hidden tab (throttled) or during the boot
 * intro (chunk evaluation, compile) are not counted; the probe restarts.
 */
export function startFrameProbe() {
  if (typeof window === "undefined" || probe !== "idle" || downgraded) return;
  probe = "running";
  mark("probing");
  const html = document.documentElement;
  let frames = 0;
  let total = 0;
  let last = 0;
  const reset = () => {
    frames = 0;
    total = 0;
    last = 0;
  };
  const tick = (t: number) => {
    if (document.visibilityState === "hidden" || html.dataset.intro === "running") {
      reset();
      requestAnimationFrame(tick);
      return;
    }
    // a long gap (tab switch, a stall before visibilityState caught up)
    // restarts the count rather than failing it
    if (last && t - last > 1000) reset();
    if (last) {
      frames++;
      if (frames > WARMUP_FRAMES) total += t - last;
    }
    last = t;
    if (frames < WARMUP_FRAMES + PROBE_FRAMES) {
      requestAnimationFrame(tick);
      return;
    }
    probe = "done";
    const avg = total / PROBE_FRAMES;
    html.dataset.glFrameMs = avg.toFixed(1);
    if (avg > SLOW_FRAME_MS) {
      downgraded = true;
      mark("off:slow-frames");
      listeners.forEach((fn) => fn());
      listeners.clear();
    } else {
      mark("on");
    }
  };
  requestAnimationFrame(tick);
}

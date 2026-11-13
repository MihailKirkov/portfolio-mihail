import { prefersReducedMotion } from "@/lib/agent/choreo";

// The one WebGL gate, shared by the shader core (components/core/core.tsx)
// and the projects depth scene (components/projects/depth-stage.tsx). Either
// runs only when it will run well:
//   - not under reduced motion
//   - not with navigator.hardwareConcurrency <= 4
//   - not with data saver on
//   - not without a hardware-backed WebGL2 context
// Callers add their own layout conditions (the core: not while hidden; the
// depth scene: only on the wide depth stage).

let probed: boolean | null = null;

function hardwareWebGL2() {
  if (probed !== null) return probed;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    probed = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    probed = false;
  }
  return probed;
}

export function canRunWebGL() {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= 4) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  return hardwareWebGL2();
}

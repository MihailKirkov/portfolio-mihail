// The core's dissolve / re-form amount, shared between the gate
// (components/core/core.tsx, which animates it) and the shader scene
// (components/core/shader-core.tsx, which reads it every frame).
// 0 = whole; 1 = gone (rings collapsed into the sphere, sphere shrunk).
export const coreMorph = { v: 0 };

/** device pixel ratio for the core's render target: sharp, but capped */
export const CORE_DPR_MAX = 1.5;
export function coreDpr() {
  return Math.min(window.devicePixelRatio || 1, CORE_DPR_MAX);
}

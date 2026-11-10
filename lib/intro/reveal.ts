"use client";

// Reveal effects for the boot intro. Each one animates a REAL hero element
// (opacity / clip-path / transform / colour) with the Web Animations API; there
// is never a second copy of the DOM. While <html data-intro> is set, CSS holds
// every [data-intro-part] in its "before" state; an animation's `fill: both`
// carries the element from there to its final look. `stopReveals` cancels
// everything at once, and because it runs in the same task that removes
// data-intro, the elements land on their natural (fully visible) styles with
// no flash in between.

export type IntroPart = "label" | "headline" | "sub" | "status" | "core" | "frame" | "cta";

const running = new Set<Animation>();

export function introPart(name: IntroPart): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-intro-part="${name}"]`);
}

/** resolve when the animation ends, is cancelled, or the step is aborted */
function play(
  el: HTMLElement | null,
  keyframes: Keyframe[],
  opts: KeyframeAnimationOptions,
  signal?: AbortSignal
): Promise<void> {
  if (!el || signal?.aborted) return Promise.resolve();
  const a = el.animate(keyframes, { fill: "both", ...opts });
  running.add(a);
  return new Promise((resolve) => {
    a.finished.then(() => resolve(), () => resolve());
    signal?.addEventListener("abort", () => resolve());
  });
}

export function stopReveals() {
  running.forEach((a) => a.cancel());
  running.clear();
}

const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";

/** fade + small rise */
export function fadeIn(el: HTMLElement | null, ms: number, signal?: AbortSignal, delay = 0) {
  return play(
    el,
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: ms, delay, easing: EASE_OUT },
    signal
  );
}

/** a panel's frame drawn out from its top-left corner (linear, to track a drag) */
export function drawFrame(el: HTMLElement | null, ms: number, signal?: AbortSignal) {
  return play(
    el,
    [
      { opacity: 1, clipPath: "inset(0 100% 100% 0)" },
      { opacity: 1, clipPath: "inset(0 0 0 0)" },
    ],
    { duration: ms, easing: "linear" },
    signal
  );
}

/** drops in from above with a small settle */
export function dropIn(el: HTMLElement | null, ms: number, signal?: AbortSignal) {
  return play(
    el,
    [
      { opacity: 0, transform: "translateY(-48px) scale(0.92)" },
      { opacity: 1, transform: "translateY(4px) scale(1.01)", offset: 0.7 },
      { opacity: 1, transform: "none" },
    ],
    { duration: ms, easing: EASE_OUT },
    signal
  );
}

/** neutral button -> its accent fill (the CSS hold state is the neutral look) */
export function accentIn(el: HTMLElement | null, ms: number, signal?: AbortSignal) {
  const root = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  const accent = v("--accent", "#c8f542");
  return play(
    el,
    [
      { backgroundColor: "transparent", color: v("--text", "#e8eaed"), borderColor: v("--border", "#3a3f47") },
      { backgroundColor: accent, color: v("--on-accent", "#0a0b0d"), borderColor: accent },
    ],
    { duration: ms, easing: EASE_OUT },
    signal
  );
}

// ---- typing -------------------------------------------------------------------

/** one rendered line of a text block, in px relative to the block's box */
export interface LineBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** the block's line boxes, from the browser's own layout of its text */
export function lineBoxes(el: HTMLElement): LineBox[] {
  const box = el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const lines: LineBox[] = [];
  for (const r of Array.from(range.getClientRects())) {
    if (r.width === 0) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.top - box.top - last.top) < 4) {
      last.left = Math.min(last.left, r.left - box.left);
      last.right = Math.max(last.right, r.right - box.left);
      last.bottom = Math.max(last.bottom, r.bottom - box.top);
    } else {
      lines.push({
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        left: r.left - box.left,
        right: r.right - box.left,
      });
    }
  }
  return lines;
}

/**
 * where line `i` ends and line `i + 1` starts. Text rects are taller than the
 * line box when line-height is tight, so adjacent ones overlap: split at the
 * midpoint (the line-box edge), nudged down a little for descenders.
 */
function lineBoundary(lines: LineBox[], i: number, em: number) {
  return (lines[i].bottom + lines[i + 1].top) / 2 + em * 0.12;
}

/**
 * clip polygon showing every line before `i` in full, and line `i` up to x.
 * Always six points so two of them interpolate.
 */
function typedPolygon(el: HTMLElement, lines: LineBox[], i: number, x: number) {
  const em = parseFloat(getComputedStyle(el).fontSize);
  const pad = em * 0.3; // overhang past the element box
  const w = el.offsetWidth + pad;
  const top = i === 0 ? -pad : lineBoundary(lines, i - 1, em);
  const bottom =
    i === lines.length - 1 ? el.offsetHeight + pad : lineBoundary(lines, i, em);
  const px = (n: number) => `${n.toFixed(1)}px`;
  return `polygon(${[
    [-pad, -pad],
    [w, -pad],
    [w, top],
    [x, top],
    [x, bottom],
    [-pad, bottom],
  ]
    .map(([a, b]) => `${px(a)} ${px(b)}`)
    .join(", ")})`;
}

/** types line `i` of a block: a stepped clip reveal, one step per character */
export function typeLine(
  el: HTMLElement,
  lines: LineBox[],
  i: number,
  chars: number,
  ms: number,
  signal?: AbortSignal
) {
  const pad = parseFloat(getComputedStyle(el).fontSize) * 0.3;
  return play(
    el,
    [
      { opacity: 1, clipPath: typedPolygon(el, lines, i, lines[i].left - pad) },
      { opacity: 1, clipPath: typedPolygon(el, lines, i, lines[i].right + pad) },
    ],
    { duration: ms, easing: `steps(${Math.max(1, chars)}, end)` },
    signal
  );
}

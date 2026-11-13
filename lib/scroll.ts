import Lenis from "lenis";

// The page's one scroll source. On a fine pointer without reduced motion,
// Lenis smooths wheel scrolling for the whole page; under reduced motion and
// on touch devices the page keeps native scrolling. Either way everything
// that reads or moves the scroll goes through here:
//   - position(), velocity(), onScroll(): the depth stage, the docked core's
//     flight and the cursor engine read the scroll from here
//   - scrollToY() / scrollToEl(): agent actions, the cursor engine, the rail,
//     "skip projects" and every same-page #link
// Lenis ignores wheel input while the boot intro holds the page
// (<html data-intro>): the head script absorbs it, and Lenis must not
// replay it. It is stopped while any <dialog> is open (the detail overlay,
// the gallery viewer); a dialog's own content still scrolls natively.

let lenis: Lenis | null = null;
/** a scroll this module started is in flight (not the visitor's) */
let programmatic = 0;
let lastVel = 0;
let lastAt = 0;
const listeners = new Set<(s: ScrollInfo) => void>();

export interface ScrollInfo {
  y: number;
  /** px per frame, signed; 0 at rest */
  velocity: number;
  /** the visitor's scroll, not one started through this module */
  user: boolean;
}

export function smoothScrollActive() {
  return lenis !== null;
}

export function position() {
  return lenis ? lenis.animatedScroll : window.scrollY;
}

/** px per frame, signed; decays to 0 once scrolling stops */
export function velocity() {
  if (performance.now() - lastAt > 100) return 0;
  return lastVel;
}

export function onScroll(cb: (s: ScrollInfo) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit(y: number, v: number) {
  lastVel = v;
  lastAt = performance.now();
  const info = { y, velocity: v, user: programmatic === 0 };
  listeners.forEach((cb) => cb(info));
}

export interface ScrollOpts {
  instant?: boolean;
  signal?: AbortSignal;
}

/** scroll the page to y; resolves when it arrives, is aborted or is taken over */
export function scrollToY(y: number, { instant = false, signal }: ScrollOpts = {}): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    programmatic++;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      programmatic--;
      signal?.removeEventListener("abort", abort);
      clearTimeout(cap);
      resolve();
    };
    // a cancel stops the scroll where it is
    const abort = () => {
      if (lenis) lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
      else window.scrollTo({ top: window.scrollY, behavior: "instant" });
      finish();
    };
    signal?.addEventListener("abort", abort);
    const cap = setTimeout(finish, instant ? 0 : 2000);

    if (lenis) {
      lenis.scrollTo(y, {
        immediate: instant,
        force: true,
        duration: instant ? undefined : 1.0,
        onComplete: finish,
      });
      if (instant) finish();
      return;
    }
    window.scrollTo({ top: y, behavior: instant ? "instant" : "smooth" });
    if (instant) return finish();
    // native: settled once the position holds for a few frames
    let last = window.scrollY;
    let still = 0;
    const tick = () => {
      if (done) return;
      const now = window.scrollY;
      still = now === last ? still + 1 : 0;
      last = now;
      if (still >= 6) return finish();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** the y that brings el's top under the top bar (honours scroll-margin-top) */
export function yOf(el: Element) {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return el.getBoundingClientRect().top + position() - margin;
}

export function scrollToEl(el: Element, opts?: ScrollOpts) {
  return scrollToY(yOf(el), opts);
}

/** same-page #links: through the one scroll source, the hash kept in the URL */
function onLinkClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='#']");
  if (!a || a.target) return;
  const id = decodeURIComponent(a.hash.slice(1));
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  history.pushState(null, "", `#${id}`);
  void scrollToEl(el, { instant: prefersReducedMotion() });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** start the scroll source; returns a teardown */
export function initScroll(): () => void {
  const html = document.documentElement;
  let nativeY = window.scrollY;
  let mo: MutationObserver | null = null;

  const onNative = () => {
    const y = window.scrollY;
    emit(y, y - nativeY);
    nativeY = y;
  };

  if (!prefersReducedMotion() && finePointer()) {
    lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      // the boot intro owns wheel input while it holds the page
      virtualScroll: () => !html.hasAttribute("data-intro"),
      // dialogs (detail overlay, gallery viewer) scroll their own content
      prevent: (node) => node.nodeName === "DIALOG",
    });
    lenis.on("scroll", (l: Lenis) => emit(l.animatedScroll, l.velocity));
    // stopped while a dialog is open
    const syncDialogs = () => {
      if (!lenis) return;
      if (document.querySelector("dialog[open]")) lenis.stop();
      else lenis.start();
    };
    mo = new MutationObserver(syncDialogs);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    syncDialogs();
  } else {
    window.addEventListener("scroll", onNative, { passive: true });
  }
  document.addEventListener("click", onLinkClick);

  return () => {
    mo?.disconnect();
    lenis?.destroy();
    lenis = null;
    window.removeEventListener("scroll", onNative);
    document.removeEventListener("click", onLinkClick);
  };
}

// The choreography clock: timers whose rate can change while they run.
// Normally rate 1, i.e. plain setTimeout. The boot intro raises it to fast-
// forward whatever is left (components/intro/boot-intro.tsx); the cursor
// driver and the intro's reveals follow it too (onRate), so every wait, flight
// and reveal in flight speeds up together and nothing falls out of step.

interface Timer {
  /** clock ms still to go, as of `since` */
  left: number;
  since: number;
  id: ReturnType<typeof setTimeout>;
  fn: () => void;
}

let rate = 1;
const timers = new Set<Timer>();
const listeners = new Set<(rate: number) => void>();

export function getRate() {
  return rate;
}

export function setRate(next: number) {
  if (!(next > 0) || next === rate) return;
  const now = performance.now();
  timers.forEach((t) => {
    t.left = Math.max(0, t.left - (now - t.since) * rate);
    t.since = now;
    clearTimeout(t.id);
    t.id = setTimeout(() => fire(t), t.left / next);
  });
  rate = next;
  listeners.forEach((fn) => fn(next));
}

function fire(t: Timer) {
  timers.delete(t);
  t.fn();
}

/** a timeout in clock ms; returns its cancel */
export function after(ms: number, fn: () => void): () => void {
  const t: Timer = { left: ms, since: performance.now(), fn, id: undefined as never };
  t.id = setTimeout(() => fire(t), ms / rate);
  timers.add(t);
  return () => {
    clearTimeout(t.id);
    timers.delete(t);
  };
}

/** follow rate changes; returns the unsubscribe */
export function onRate(fn: (rate: number) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** wait `ms` clock ms, or less if aborted */
export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const cancel = after(ms, resolve);
    signal?.addEventListener("abort", () => {
      cancel();
      resolve();
    });
  });
}

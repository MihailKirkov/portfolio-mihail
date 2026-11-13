"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CoreSlot } from "@/components/core/core-slot";
import { onScroll, scrollToY } from "@/lib/scroll";

// The journey (V3-PLAN Round 2, part 4; target docs/design/journey.html).
// About and experience in one scroll-driven stage: the camera flies through
// one gate per step, oldest first, newest last; the first gate is About.
// The server renders the vertical timeline (with the about block) as the
// fallback: phones, reduced motion, no JS. On a wide screen with motion the
// stage replaces it. The stage is a sticky viewport inside a tall track; the
// scroll position along the track is the camera's place on the path.
// - gates: flat frames scaled about the vanishing point by their distance
//   from the camera (2^-d); a passed gate scales past the viewport edges and
//   fades, the next ones are already visible behind the current one
// - a big faint year behind the current gate
// - a flat info panel on the left, never transformed: it crossfades to the
//   current step
// - a year rail on the right: position, and a jump on click
// - the core's spot (CoreSlot "journey") is the tip of the floor path

export interface JourneyStep {
  id: string;
  /** a certification: a small marker on the path, not a full gate */
  kind?: "cert";
  /** the year shown behind the gate and on the rail */
  year: string;
  /** the gate's small label */
  label: string;
  /** panel: date line, title, role line, text, bullets */
  date: string;
  /** the current gate's label (a role's start) */
  start?: string;
  title: string;
  role?: string;
  text?: string;
  bullets?: string[];
  /** the About gate: photo + text */
  photo?: { src: string; alt: string };
  /** the About gate: short labelled facts (competitive, languages, education) */
  facts?: { label: string; lines: string[] }[];
}

/** vanishing point, as a share of the stage (reference: 950,438 at 1440x900) */
const VX = 0.66;
const VY = 0.487;
/** the current gate's size at 1440x900 */
const GATE_W = 380;
const GATE_H = 260;
const DESIGN_W = 1440;
/** viewport heights of scroll per step */
const STEP_VH = 0.9;

export function Journey({ steps, children }: { steps: JourneyStep[]; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const gates = useRef<(HTMLDivElement | null)[]>([]);
  const [able, setAble] = useState(false);
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAble(wide.matches && !still.matches);
    update();
    wide.addEventListener("change", update);
    still.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      still.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!able || !el) return;
    const n = steps.length;
    const frame = () => {
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const t = Math.min(1, Math.max(0, -r.top / span));
      const p = t * (n - 1);
      const k = Math.min(1, el.offsetWidth / DESIGN_W);
      el.style.setProperty("--k", String(k));
      gates.current.forEach((g, i) => {
        if (!g) return;
        const d = i - p;
        const s = Math.pow(2, -d);
        // passed gates fade as they scale past the edges; far ones fade in
        const o = d < 0 ? Math.max(0, 1 + d * 0.6) : Math.max(0, 1 - Math.max(0, d - 2.5));
        g.style.transform = `translate(-50%, -50%) scale(${s})`;
        // labels stay readable at every distance
        g.style.setProperty("--inv", String(1 / s));
        g.style.opacity = String(o);
        g.toggleAttribute("data-current", Math.abs(d) < 0.5);
        g.toggleAttribute("data-passed", d <= -0.5);
      });
      setCur(Math.min(n - 1, Math.max(0, Math.round(p))));
    };
    const stop = onScroll(frame);
    window.addEventListener("resize", frame);
    frame();
    return () => {
      stop();
      window.removeEventListener("resize", frame);
    };
  }, [able, steps.length]);

  const jump = (i: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    void scrollToY(top + (span * i) / Math.max(1, steps.length - 1) + 1);
  };

  if (!able) return <>{children}</>;
  const step = steps[cur];
  const about = steps[0];
  // one rail entry per year, jumping to that year's first step
  const rail: { year: string; i: number; last: boolean }[] = [];
  steps.forEach((s, i) => {
    if (i > 0 && s.year && !rail.some((r) => r.year === s.year)) rail.push({ year: s.year, i, last: false });
  });
  if (rail.length) rail[rail.length - 1].last = true;
  return (
    <div
      className="jr"
      ref={track}
      data-steps={steps.length}
      style={{ height: `calc(${(steps.length - 1) * STEP_VH * 100}vh + 100vh)` }}
    >
      <div className="jr-stage">
        <div className="jr-year" aria-hidden="true">
          {step.year}
        </div>
        <svg className="jr-floor" aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <g stroke="#1c1f24">
            <line x1="950" y1="438" x2="200" y2="900" />
            <line x1="950" y1="438" x2="1440" y2="900" />
            <line x1="950" y1="438" x2="1440" y2="620" />
            <line x1="950" y1="438" x2="0" y2="620" />
          </g>
          <path d="M 700 900 L 950 438" stroke="var(--accent)" strokeOpacity="0.15" strokeWidth="18" />
          <path d="M 700 900 L 950 438" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        <div className="jr-gates" aria-hidden="true" style={{ left: `${VX * 100}%`, top: `${VY * 100}%` }}>
          {steps.map((s, i) => (
            <div
              key={s.id}
              ref={(n) => {
                gates.current[i] = n;
              }}
              className="jr-gate"
              data-kind={s.kind}
              style={{ width: `calc(${GATE_W}px * var(--k, 1))`, height: `calc(${GATE_H}px * var(--k, 1))` }}
            >
              <span className="jr-gate-label">
                {i === cur ? `current gate · ${s.start ?? s.date}` : s.label}
              </span>
            </div>
          ))}
        </div>
        {/* the core rides the tip of the path */}
        <CoreSlot spot="journey" className="jr-core" />

        {cur > 0 && about.photo && (
          <div className="jr-passed" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="jr-photo jr-photo-sm" src={about.photo.src} alt="" />
            <span>{about.title} · passed</span>
          </div>
        )}

        <div className="jr-panel" key={step.id} aria-live="polite">
          {step.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="jr-photo" src={step.photo.src} alt={step.photo.alt} />
          )}
          {step.kind === "cert" && <p className="jr-date">certification · {step.date}</p>}
          {step.kind !== "cert" && step.date && <p className="jr-date">{step.date}</p>}
          <h3 className="jr-title">{step.title}</h3>
          {step.role && <p className="jr-role">{step.role}</p>}
          {step.text && <p className="jr-text">{step.text}</p>}
          {step.facts && (
            <dl className="jr-facts">
              {step.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  {f.lines.map((l, i) => (
                    <dd key={i}>{l}</dd>
                  ))}
                </div>
              ))}
            </dl>
          )}
          {step.bullets && step.bullets.length > 0 && (
            <ul className="jr-bullets">
              {step.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>

        <ol className="jr-rail">
          {rail.map(({ year, i, last }) => {
            const on = steps[cur].year === year;
            return (
              <li key={year}>
                <button type="button" data-on={on || undefined} data-last={last || undefined} onClick={() => jump(i)}>
                  {on && <span className="jr-rail-tick" aria-hidden="true" />}
                  {last && steps[steps.length - 1].role ? `${year} · ${steps[steps.length - 1].title}` : year}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { CoreSlot } from "@/components/core/core-slot";
import { agentId } from "@/lib/agent/targets";
import { position } from "@/lib/scroll";
import { projectsUsing, TIERS, type SkillNode } from "@/lib/skills";

// The stack constellation (V3-PLAN Round 2, part 2). Skills orbit the core in
// three tilted elliptical rings by tier: daily inner and bright, shipped-with
// middle, familiar outer and dim. Each group owns a sector of every ring and
// its label sits quietly outside the outer ring at that sector.
//
// DOM, not WebGL: every skill is a real link or button in a real list, so it
// is focusable and readable, and the page spends no extra WebGL context. The
// core itself flies in to the centre (CoreSlot spot "stack").
//
// Motion: the rings drift slowly and turn a little with scroll; the scroll
// value is read straight from Lenis every frame (no springs). Positions are
// written as transforms only. The loop runs only while the stage is on screen
// and the tab is visible, and holds still while a skill is active.
//
// Hover, focus or the agent's highlight (the data-agent-active pulse on a
// skill) makes that skill active: it lights up and lines run to a small card
// for every project whose stack includes it.

export interface ConstellationProject {
  slug: string;
  name: string;
  thumb: string | null;
  stack: string[];
}

/** ring radius as a share of the stage half-width, by tier */
const RING_R = [0.36, 0.6, 0.84];
/** ellipse flattening (ry / rx) and in-plane tilt, by tier */
const RING_FLAT = [0.34, 0.32, 0.3];
const RING_TILT = [-0.16, 0.1, -0.05];
/** drift, rad/s, and turn per px of scroll, by tier */
const RING_DRIFT = [0.035, -0.024, 0.016];
const RING_SCROLL = [0.0007, -0.00055, 0.0004];
const RING_ALPHA = [1, 0.82, 0.5];
/** card slots around the stage, as fractions of its box */
// clear of the docked command bar at the bottom of the viewport
const CARD_SLOTS: [number, number][] = [
  [0.1, 0.14],
  [0.9, 0.14],
  [0.08, 0.68],
  [0.92, 0.68],
  [0.5, 0.11],
];
const PULSE_HOLD_MS = 2000;

export function Constellation({
  skills,
  projects,
}: {
  skills: SkillNode[];
  projects: ConstellationProject[];
}) {
  const stage = useRef<HTMLDivElement>(null);

  // per skill: ring, base angle and the projects that use it
  const layout = useMemo(() => {
    const groups = [...new Set(skills.map((s) => s.group))];
    const sector = (Math.PI * 2) / Math.max(1, groups.length);
    const center = (g: string) => -Math.PI / 2 + groups.indexOf(g) * sector;
    const nodes = skills.map((s) => {
      const ring = Math.max(0, TIERS.indexOf(s.tier));
      const peers = skills.filter((o) => o.group === s.group && o.tier === s.tier);
      const j = peers.indexOf(s);
      const step = Math.min((sector * 0.86) / Math.max(1, peers.length), 0.42);
      const angle = center(s.group) + (j - (peers.length - 1) / 2) * step + ring * 0.11;
      const uses = projectsUsing(s.name, projects).map((p) => projects.indexOf(p));
      return { ...s, ring, angle, uses };
    });
    const labels = groups.map((g) => ({
      group: g,
      label: skills.find((s) => s.group === g)?.groupLabel ?? g,
      angle: center(g),
    }));
    return { nodes, labels };
  }, [skills, projects]);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".constel-skill"));
    const labelEls = Array.from(root.querySelectorAll<HTMLElement>(".constel-group"));
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".constel-card"));
    const lines = Array.from(root.querySelectorAll<SVGLineElement>(".constel-lines line"));
    const coreEl = root.querySelector<HTMLElement>(".constel-core");

    let active = -1;
    let hovered = -1;
    let focused = -1;
    let pulsed = -1;
    let pulseTimer = 0;
    let drift = 0;
    let last = 0;
    let raf = 0;
    let onScreen = false;
    const pts = layout.nodes.map(() => ({ x: 0, y: 0 }));

    // stage geometry, measured on resize (never per frame)
    const geo = { box: { width: 0, height: 0 }, cx: 0, cy: 0, half: 0, mid: 0 };
    let labelW: number[] = [];
    const measure = () => {
      labelW = labelEls.map((el) => el.offsetWidth);
      const box = root.getBoundingClientRect();
      const c = coreEl?.getBoundingClientRect();
      geo.box = { width: box.width, height: box.height };
      geo.cx = c ? c.left - box.left + c.width / 2 : box.width / 2;
      geo.cy = c ? c.top - box.top + c.height / 2 : box.height / 2;
      geo.half = Math.min(box.width / 2, box.height * 1.25);
      geo.mid = box.top + position() + box.height / 2 - window.innerHeight / 2;
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      if (!raf) frame(performance.now());
    });
    ro.observe(root);
    ro.observe(document.body);

    const setActive = () => {
      const next = focused >= 0 ? focused : hovered >= 0 ? hovered : pulsed;
      if (next === active) return;
      active = next;
      items.forEach((el, i) => {
        if (i === active) el.setAttribute("data-active", "");
        else el.removeAttribute("data-active");
      });
      root.toggleAttribute("data-has-active", active >= 0);
      const uses = active >= 0 ? layout.nodes[active].uses : [];
      cards.forEach((c, i) => c.toggleAttribute("data-on", uses.includes(i)));
      lines.forEach((l, i) => l.toggleAttribute("data-on", uses.includes(i)));
      if (!raf) frame(performance.now());
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (active < 0) drift += dt;

      const { box, cx, cy, half, mid } = geo;
      // scroll past the point where the stage's centre meets the viewport's
      const rel = position() - mid;

      const place = (ring: number, base: number, k = 1) => {
        const th = base + drift * RING_DRIFT[ring] + rel * RING_SCROLL[ring];
        const rx = half * RING_R[ring] * k;
        const ry = rx * RING_FLAT[ring];
        const x0 = rx * Math.cos(th);
        const y0 = ry * Math.sin(th);
        const t = RING_TILT[ring];
        return {
          x: cx + x0 * Math.cos(t) - y0 * Math.sin(t),
          y: cy + x0 * Math.sin(t) + y0 * Math.cos(t),
          // 0 at the back of the ring, 1 at the front
          depth: (Math.sin(th) + 1) / 2,
        };
      };

      layout.nodes.forEach((n, i) => {
        const el = items[i];
        const p = place(n.ring, n.angle);
        pts[i].x = p.x;
        pts[i].y = p.y;
        const on = i === active;
        const scale = on ? 1.12 : 0.84 + 0.22 * p.depth;
        const alpha = on ? 1 : active >= 0 ? 0.28 : RING_ALPHA[n.ring] * (0.55 + 0.45 * p.depth);
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        el.style.opacity = alpha.toFixed(3);
        el.style.zIndex = on ? "3" : p.depth > 0.5 ? "2" : "1";
      });

      layout.labels.forEach((l, i) => {
        const p = place(2, l.angle, 1.16);
        // kept inside the stage
        const hw = labelW[i] / 2 + 4;
        const x = Math.max(hw, Math.min(box.width - hw, p.x));
        labelEls[i].style.transform = `translate3d(${x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      });

      if (active >= 0) {
        const from = pts[active];
        lines.forEach((l, i) => {
          const [fx, fy] = CARD_SLOTS[i % CARD_SLOTS.length];
          l.setAttribute("x1", from.x.toFixed(1));
          l.setAttribute("y1", from.y.toFixed(1));
          l.setAttribute("x2", (fx * box.width).toFixed(1));
          l.setAttribute("y2", (fy * box.height).toFixed(1));
        });
      }

      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(root);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    const indexOf = (t: EventTarget | null) => {
      const el = (t as Element | null)?.closest?.<HTMLElement>(".constel-skill");
      return el ? items.indexOf(el) : -1;
    };
    const onOver = (e: PointerEvent) => {
      hovered = indexOf(e.target);
      setActive();
    };
    const onLeave = () => {
      hovered = -1;
      setActive();
    };
    const onFocusIn = (e: FocusEvent) => {
      focused = indexOf(e.target);
      setActive();
    };
    const onFocusOut = () => {
      focused = -1;
      setActive();
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);

    // the agent's highlight: lib/agent/targets.ts pulse() sets data-agent-active
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (!el.hasAttribute("data-agent-active")) continue;
        const i = items.indexOf(el);
        if (i < 0) continue;
        clearTimeout(pulseTimer);
        pulsed = i;
        setActive();
        pulseTimer = window.setTimeout(() => {
          pulsed = -1;
          setActive();
        }, PULSE_HOLD_MS);
      }
    });
    items.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ["data-agent-active"] }));

    // first layout before the first paint of the stage
    frame(performance.now());

    return () => {
      stop();
      clearTimeout(pulseTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [layout]);

  return (
    <div ref={stage} className="constel">
      <CoreSlot spot="stack" className="constel-core" />

      <svg className="constel-lines" aria-hidden="true">
        {projects.map((p) => (
          <line key={p.slug} />
        ))}
      </svg>

      {layout.labels.map((l) => (
        <span key={l.group} className="constel-group label" aria-hidden="true">
          {l.label}
        </span>
      ))}

      <ul className="constel-skills" aria-label="Skills">
        {layout.nodes.map((n) => {
          const first = n.uses.length ? projects[n.uses[0]] : null;
          const used = n.uses.map((i) => projects[i].name).join(", ");
          const sr = `, ${n.groupLabel}, ${n.tier}${used ? `, used in ${used}` : ""}`;
          return (
            <li key={n.key} className="constel-skill" data-tier={n.tier} data-agent-id={agentId.skill(n.name)}>
              {first ? (
                <a href={`#project-${first.slug}`} data-project={first.slug}>
                  {n.name}
                  <span className="sr-only">{sr}</span>
                </a>
              ) : (
                <button type="button">
                  {n.name}
                  <span className="sr-only">{sr}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {projects.map((p, i) => {
        const [x, y] = CARD_SLOTS[i % CARD_SLOTS.length];
        return (
          <div
            key={p.slug}
            className="constel-card"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-hidden="true"
          >
            {p.thumb && <Image src={p.thumb} alt="" width={112} height={70} sizes="112px" />}
            <span className="label">{p.name}</span>
          </div>
        );
      })}
    </div>
  );
}

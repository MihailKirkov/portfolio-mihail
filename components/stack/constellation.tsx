"use client";

import { useEffect, useMemo, useRef } from "react";
import { CoreSlot } from "@/components/core/core-slot";
import { agentId } from "@/lib/agent/targets";
import { position } from "@/lib/scroll";
import { projectsUsing, TIERS, type SkillNode } from "@/lib/skills";

// The stack constellation (V3-PLAN Round 2, part 2; target composition
// docs/design/stack-constellation.html). The section title and a tier legend
// sit on the left; the core sits large left of centre with three flat
// elliptical rings drawn round it. Skills are plain text labels on the rings
// by tier (daily inner and bright, shipped-with middle, familiar outer and
// dim); a ring that is over capacity spills to the others so the labels keep
// their room. Each group owns a sector of every ring; its label sits quietly
// outside the outer ring.
//
// Labels never overlap: every frame, after placement, overlapping labels are
// nudged apart along their own ring (and off the core and the group labels),
// and the nudges ease back once there is room.
//
// DOM, not WebGL: every skill is a real link or button in a real list, so it
// is focusable and readable. The core itself flies in (CoreSlot spot "stack").
//
// Motion: the rings sway slowly and turn a little with scroll; the scroll
// value is read straight from Lenis every frame (no springs). Transforms
// only. The loop runs only while the stage is on screen and the tab is
// visible, and holds still while a skill is active.
//
// Hover, focus or the agent's highlight (the data-agent-active pulse on a
// skill) makes that skill active: it lights up and curved lines run to cards,
// stacked on the right, for every project whose stack includes it.

export interface ConstellationProject {
  slug: string;
  name: string;
  blurb: string;
  stack: string[];
}

/** design width the radii are given at */
const DESIGN_W = 1200;
/** ring radii (x) at the design width and flattening (ry / rx), by ring */
const RING_RX = [140, 250, 360];
const RING_FLAT = 0.415;
/** how many labels a ring holds before it spills */
// the inner ring loses its top and bottom to the core
const RING_CAP = [4, 12, 17];
/** sway amplitude (rad), sway speed (rad/s) and turn per px of scroll */
const RING_SWAY = [0.12, -0.09, 0.07];
const RING_SWAY_W = [0.21, 0.17, 0.13];
const RING_SCROLL = [0.00035, -0.00028, 0.0002];
/** core centre as a share of the stage */
const CX = 0.433;
const CY = 0.52;
/** cards column: left edge as a share of the stage, card gap */
const CARD_X = 0.787;
const CARD_GAP = 22;
/** the core's visible sphere radius as a share of its slot */
const CORE_R = 0.3;
const PAD = 6;
const PULSE_HOLD_MS = 2000;

/** ring per skill: its tier's ring, spilling round-robin by group to the
 *  least loaded ring with room while a ring is over capacity */
function assignRings(skills: SkillNode[]) {
  const ring = skills.map((s) => Math.max(0, TIERS.indexOf(s.tier)));
  const load = [0, 1, 2].map((r) => ring.filter((x) => x === r).length);
  for (let r = 0; r < 3; r++) {
    while (load[r] > RING_CAP[r]) {
      const to = [0, 1, 2]
        .filter((o) => o !== r && load[o] < RING_CAP[o])
        .sort((a, b) => load[a] / RING_CAP[a] - load[b] / RING_CAP[b])[0];
      if (to === undefined) break;
      // move one skill from the group that holds most of this ring
      const count = new Map<string, number>();
      skills.forEach((s, i) => ring[i] === r && count.set(s.group, (count.get(s.group) ?? 0) + 1));
      const group = [...count].sort((a, b) => b[1] - a[1])[0][0];
      let i = -1;
      skills.forEach((s, j) => {
        if (ring[j] === r && s.group === group) i = j;
      });
      ring[i] = to;
      load[r]--;
      load[to]++;
    }
  }
  return ring;
}

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
    const rings = assignRings(skills);
    const sector = (Math.PI * 2) / Math.max(1, groups.length);
    // first sector at the upper left, clear of the cards on the right
    const center = (g: string) => Math.PI * 1.1 + groups.indexOf(g) * sector;
    const nodes = skills.map((s, i) => {
      const ring = rings[i];
      const peers = skills.filter((o, j) => o.group === s.group && rings[j] === ring);
      const j = peers.indexOf(s);
      const step = (sector * 0.84) / Math.max(1, peers.length);
      const angle = center(s.group) + (j - (peers.length - 1) / 2) * step + (ring - 1) * 0.18;
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
    const lines = Array.from(root.querySelectorAll<SVGPathElement>(".constel-lines path"));
    const ringEls = Array.from(root.querySelectorAll<SVGEllipseElement>(".constel-rings ellipse"));
    const coreEl = root.querySelector<HTMLElement>(".constel-core");
    const n = layout.nodes.length;

    let active = -1;
    let hovered = -1;
    let focused = -1;
    let pulsed = -1;
    let pulseTimer = 0;
    let t = 0;
    let last = 0;
    let raf = 0;
    let onScreen = false;
    const pts = layout.nodes.map(() => ({ x: 0, y: 0 }));
    /** collision nudge per skill, in rad along its ring */
    const nudge = new Float32Array(n);

    // stage geometry, measured on resize (never per frame)
    const geo = { w: 0, h: 0, cx: 0, cy: 0, k: 1, coreR: 0, mid: 0 };
    let sizes: { w: number; h: number }[] = [];
    let labelW: number[] = [];
    const cardH: number[] = [];
    const measure = () => {
      sizes = items.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
      labelW = labelEls.map((el) => el.offsetWidth);
      cards.forEach((c, i) => (cardH[i] = c.offsetHeight));
      const box = root.getBoundingClientRect();
      geo.w = box.width;
      geo.h = box.height;
      geo.cx = box.width * CX;
      geo.cy = box.height * CY;
      geo.k = Math.min(1, box.width / DESIGN_W);
      geo.coreR = (coreEl?.offsetWidth ?? 0) * CORE_R;
      geo.mid = box.top + position() + box.height / 2 - window.innerHeight / 2;
      ringEls.forEach((el, r) => {
        el.setAttribute("cx", geo.cx.toFixed(1));
        el.setAttribute("cy", geo.cy.toFixed(1));
        el.setAttribute("rx", (RING_RX[r] * geo.k).toFixed(1));
        el.setAttribute("ry", (RING_RX[r] * geo.k * RING_FLAT).toFixed(1));
      });
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      if (!raf) frame(performance.now());
    });
    ro.observe(root);
    ro.observe(document.body);

    // the cards for the active skill, stacked on the right round the core's height
    const cardSpots = (uses: number[]) => {
      const total = uses.reduce((a, i) => a + cardH[i], 0) + CARD_GAP * Math.max(0, uses.length - 1);
      let y = geo.cy - total / 2;
      const out = new Map<number, number>();
      uses.forEach((i) => {
        out.set(i, y);
        y += cardH[i] + CARD_GAP;
      });
      return out;
    };

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
      const spots = cardSpots(uses);
      const left = geo.w * CARD_X;
      cards.forEach((c, i) => {
        const on = spots.has(i);
        c.toggleAttribute("data-on", on);
        if (on) c.style.transform = `translate3d(${left.toFixed(1)}px, ${spots.get(i)!.toFixed(1)}px, 0)`;
      });
      lines.forEach((l, i) => l.toggleAttribute("data-on", spots.has(i)));
      if (!raf) frame(performance.now());
    };

    const offset = (ring: number, rel: number) =>
      RING_SWAY[ring] * Math.sin(t * RING_SWAY_W[ring]) + rel * RING_SCROLL[ring];

    const place = (ring: number, th: number, scale = 1) => {
      const rx = RING_RX[ring] * geo.k * scale;
      return { x: geo.cx + rx * Math.cos(th), y: geo.cy + rx * RING_FLAT * Math.sin(th) };
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (active < 0) t += dt;
      const rel = position() - geo.mid;

      // group labels: fixed obstacles just outside the outer ring
      const groupBox = layout.labels.map((l, i) => {
        const a = l.angle + offset(2, rel);
        const p = place(2, a, 1.12);
        // pushed further out above and below, where the ring is flat
        const y = p.y + Math.sin(a) * 30 * geo.k;
        const hw = labelW[i] / 2;
        const x = Math.max(hw, Math.min(geo.w * CARD_X - 24 - hw, p.x));
        labelEls[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        return { x, y, hw: hw + PAD, hh: 9 + PAD / 2 };
      });

      const th = layout.nodes.map((nd, i) => nd.angle + offset(nd.ring, rel) + nudge[i]);
      const setPts = () =>
        layout.nodes.forEach((nd, i) => {
          const p = place(nd.ring, th[i]);
          pts[i].x = p.x;
          pts[i].y = p.y;
        });
      setPts();

      // collision avoidance: push overlapping labels apart along their rings
      /** tangent of label i's ring at its angle, unit length, and the ring's
       *  px per rad there */
      const tangent = (i: number) => {
        const rx = RING_RX[layout.nodes[i].ring] * geo.k;
        const tx = -rx * Math.sin(th[i]);
        const ty = rx * RING_FLAT * Math.cos(th[i]);
        const len = Math.hypot(tx, ty) || 1;
        return { tx: tx / len, ty: ty / len, len };
      };
      /** move label i along its ring by amt px, forward (1) or back (-1) */
      const shift = (i: number, dir: number, amt: number) => {
        const d = (dir * amt) / tangent(i).len;
        th[i] += d;
        nudge[i] += d;
      };
      /** the way along its ring that takes label i away from (dx, dy) */
      const away = (i: number, dx: number, dy: number) => {
        const { tx, ty } = tangent(i);
        const dot = (dx * tx + dy * ty) / (Math.hypot(dx, dy) || 1);
        return Math.abs(dot) < 0.25 ? 0 : Math.sign(dot);
      };
      const push = (i: number, dx: number, dy: number, amt: number) => shift(i, away(i, dx, dy) || 1, amt);
      const separate = (i: number, j: number, amt: number) => {
        const a = pts[i];
        const b = pts[j];
        let si: number;
        let sj: number;
        if (layout.nodes[i].ring === layout.nodes[j].ring) {
          // same ring: keep their order, open the gap
          si = th[i] >= th[j] ? 1 : -1;
          sj = -si;
        } else {
          si = away(i, a.x - b.x, a.y - b.y);
          sj = away(j, b.x - a.x, b.y - a.y);
          // side by side across the tangent: split them anyway
          if (!si && !sj) [si, sj] = [1, -1];
          else if (!si) si = -sj;
          else if (!sj) sj = -si;
        }
        shift(i, si, amt);
        shift(j, sj, amt);
      };
      for (let iter = 0; iter < 8; iter++) {
        let moved = false;
        for (let i = 0; i < n; i++) {
          const a = pts[i];
          const ah = sizes[i].h / 2 + PAD / 2;
          const aw = sizes[i].w / 2 + PAD;
          for (let j = i + 1; j < n; j++) {
            const b = pts[j];
            const ox = aw + sizes[j].w / 2 + PAD - Math.abs(a.x - b.x);
            const oy = ah + sizes[j].h / 2 + PAD / 2 - Math.abs(a.y - b.y);
            if (ox <= 0 || oy <= 0) continue;
            const amt = Math.min(ox, oy * 2, 14) / 2 + 0.5;
            separate(i, j, amt);
            moved = true;
          }
          // off the core (gentler, so it never pins two labels together)
          const cr = geo.coreR + PAD;
          const ox = aw + cr - Math.abs(a.x - geo.cx);
          const oy = ah + cr * 0.9 - Math.abs(a.y - geo.cy);
          if (ox > 0 && oy > 0) {
            push(i, a.x - geo.cx, 0, Math.min(ox, 3));
            moved = true;
          }
          // off the group labels
          for (const g of groupBox) {
            const gx = aw + g.hw - Math.abs(a.x - g.x);
            const gy = ah + g.hh - Math.abs(a.y - g.y);
            if (gx > 0 && gy > 0) {
              push(i, a.x - g.x, a.y - g.y, Math.min(gx, gy * 2, 10));
              moved = true;
            }
          }
        }
        if (!moved) break;
        setPts();
      }
      // ease the nudges back while there is room
      for (let i = 0; i < n; i++) nudge[i] *= 0.995;

      layout.nodes.forEach((nd, i) => {
        items[i].style.transform = `translate3d(${pts[i].x.toFixed(1)}px, ${pts[i].y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      });

      if (active >= 0) {
        const from = pts[active];
        const spots = cardSpots(layout.nodes[active].uses);
        const fx = from.x + sizes[active].w / 2 + 4;
        const tx = geo.w * CARD_X - 4;
        lines.forEach((l, i) => {
          const y = spots.get(i);
          if (y === undefined) return;
          const ty = y + cardH[i] / 2;
          const dx = tx - fx;
          l.setAttribute(
            "d",
            `M ${fx.toFixed(1)} ${from.y.toFixed(1)} C ${(fx + dx * 0.45).toFixed(1)} ${from.y.toFixed(1)}, ${(tx - dx * 0.35).toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`
          );
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

    const indexOf = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest?.<HTMLElement>(".constel-skill");
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

    // settle the first layout (collisions resolved) before the first paint
    for (let k = 0; k < 30; k++) frame(performance.now());

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
      <svg className="constel-rings" aria-hidden="true">
        <ellipse data-ring="0" />
        <ellipse data-ring="1" />
        <ellipse data-ring="2" />
      </svg>
      <svg className="constel-lines" aria-hidden="true">
        {projects.map((p) => (
          <path key={p.slug} />
        ))}
      </svg>

      <CoreSlot spot="stack" className="constel-core" />

      <div className="constel-legend" aria-hidden="true">
        <ul>
          {TIERS.map((tier) => (
            <li key={tier} data-tier={tier}>
              {tier}
            </li>
          ))}
        </ul>
      </div>

      {layout.labels.map((l) => (
        <span key={l.group} className="constel-group label" aria-hidden="true">
          {l.label}
        </span>
      ))}

      <ul className="constel-skills" aria-label="Skills">
        {layout.nodes.map((nd) => {
          const first = nd.uses.length ? projects[nd.uses[0]] : null;
          const used = nd.uses.map((i) => projects[i].name).join(", ");
          const sr = `, ${nd.groupLabel}, ${nd.tier}${used ? `, used in ${used}` : ""}`;
          return (
            <li key={nd.key} className="constel-skill" data-tier={nd.tier} data-agent-id={agentId.skill(nd.name)}>
              {first ? (
                <a href={`#project-${first.slug}`} data-project={first.slug}>
                  {nd.name}
                  <span className="sr-only">{sr}</span>
                </a>
              ) : (
                <button type="button">
                  {nd.name}
                  <span className="sr-only">{sr}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {projects.map((p) => (
        <div key={p.slug} className="constel-card" aria-hidden="true">
          <span className="constel-card-name">{p.name}</span>
          <span className="constel-card-blurb">{p.blurb}</span>
        </div>
      ))}
    </div>
  );
}

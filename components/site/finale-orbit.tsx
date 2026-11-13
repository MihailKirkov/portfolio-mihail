"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { choreo } from "@/lib/agent/choreo";
import { getAgentState, setAgentState } from "@/lib/agent/store";
import { agentId } from "@/lib/agent/targets";
import { position } from "@/lib/scroll";

// The finale (V3-PLAN Round 2, part 3; target composition
// docs/design/contact-finale.html). As contact scrolls in, the docked bar
// hides (store `finale`), the core flies to the large slot (CoreSlot
// "contact"), the project images fly in from the viewport's edges to small
// tilted slabs in the outer region round it and a few skills drift in. All of
// it is a function of the Lenis scroll value, so scrolling back up plays it
// in reverse and the bar returns. Once it has settled the agent cursor parks
// on the email with a "click to copy" label.
//
// Nothing lands on the text: every slot is checked against a safe zone (the
// headline, email and buttons, the core's halo, the top bar) and against the
// slots placed before it, and slides outward until clear, or is dropped.
//
// DOM transforms and opacity only; the loop runs only while contact is near
// the viewport and the tab is visible.

export interface FinaleItem {
  slug: string;
  src: string;
}

/** image slots round the core at 1440x900: dx, dy from the core, width, tilt */
const IMG_SLOTS: [number, number, number, number][] = [
  [-410, -142, 120, -8],
  [390, -168, 100, 10],
  [470, 255, 84, -6],
  [-475, 252, 76, 7],
  [-600, 40, 70, -4],
];
/** skill slots: dx, dy from the core */
const SKILL_SLOTS: [number, number][] = [
  [-250, -250],
  [270, -262],
  [600, 30],
  [-640, -210],
  [-330, 140],
  [340, 120],
];
/** the core's halo radius at 1440x900, kept clear */
const HALO_R = 205;
const GAP = 16;
const SETTLE_MS = 700;

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function FinaleOrbit({ images, skills }: { images: FinaleItem[]; skills: string[] }) {
  const layer = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = layer.current;
    const section = root?.closest("section");
    const slot = section?.querySelector<HTMLElement>('[data-core-slot="contact"]');
    if (!root || !section || !slot) return;
    const imgs = Array.from(root.querySelectorAll<HTMLElement>(".finale-img"));
    const tags = Array.from(root.querySelectorAll<HTMLElement>(".finale-skill"));
    const main = section.querySelector<HTMLElement>(".contact-main");

    // geometry in document coordinates, measured on resize
    const geo = { secTop: 0, cx: 0, cy: 0, vw: 0, vh: 0, maxY: 0 };
    type Spot = { dx: number; dy: number; w: number; rot: number; on: boolean };
    let imgSpots: Spot[] = [];
    let tagSpots: Spot[] = [];

    /** settled spots, relative to the core: each slot slides outward until it
     *  is clear of the safe zone and of the spots before it */
    const settle = () => {
      const { vw, vh, cx } = geo;
      const kx = Math.min(1.2, Math.max(0.7, vw / 1440));
      const ky = Math.min(1.2, Math.max(0.7, vh / 900));
      const k = Math.min(kx, ky);
      // with the scene settled the core sits at `to` (see frame); in viewport px
      const coreY = geo.cy - Math.min(geo.cy - vh / 2, geo.maxY);
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 64;
      const m = main?.getBoundingClientRect();
      const text = m
        ? { l: m.left - GAP * 2, r: m.right + GAP * 2, t: coreY + (m.top - slot.getBoundingClientRect().top - slot.offsetHeight / 2) - GAP * 2, b: vh }
        : null;
      const halo = HALO_R * k;
      const taken: { l: number; r: number; t: number; b: number }[] = [];
      const fits = (bx: { l: number; r: number; t: number; b: number }) => {
        if (bx.l < GAP || bx.r > vw - GAP || bx.t < top + GAP || bx.b > vh - GAP) return false;
        if (text && bx.l < text.r && text.l < bx.r && bx.t < text.b && text.t < bx.b) return false;
        // clear of the halo: nearest point of the box to the core
        const nx = Math.max(bx.l, Math.min(cx, bx.r)) - cx;
        const ny = Math.max(bx.t, Math.min(coreY, bx.b)) - coreY;
        if (Math.hypot(nx, ny) < halo) return false;
        return !taken.some((o) => bx.l < o.r + GAP && o.l < bx.r + GAP && bx.t < o.b + GAP && o.t < bx.b + GAP);
      };
      const place = (dx0: number, dy0: number, w: number, h: number, rot: number): Spot => {
        const dir = Math.sign(dx0) || 1;
        for (let step = 0; step < 60; step++) {
          const dx = dx0 * kx + dir * step * 10;
          const dy = dy0 * ky;
          const bx = { l: cx + dx - w / 2, r: cx + dx + w / 2, t: coreY + dy - h / 2, b: coreY + dy + h / 2 };
          if (bx.l < 0 || bx.r > vw) break;
          if (fits(bx)) {
            taken.push(bx);
            return { dx, dy, w, rot, on: true };
          }
        }
        return { dx: dx0, dy: dy0, w, rot, on: false };
      };
      imgSpots = IMG_SLOTS.slice(0, imgs.length).map(([dx, dy, w, rot]) => {
        const ww = Math.round(w * k);
        return place(dx, dy, ww, ww * 0.625 + 8, rot);
      });
      tagSpots = tags.map((el, i) => {
        const [dx, dy] = SKILL_SLOTS[i % SKILL_SLOTS.length];
        return place(dx, dy, el.offsetWidth, el.offsetHeight, 0);
      });
      imgs.forEach((el, i) => (el.style.width = `${imgSpots[i].w}px`));
    };

    const measure = () => {
      const y = position();
      const s = section.getBoundingClientRect();
      const c = slot.getBoundingClientRect();
      geo.secTop = s.top + y;
      geo.cx = c.left + c.width / 2;
      geo.cy = c.top + c.height / 2 + y;
      geo.vw = window.innerWidth;
      geo.vh = window.innerHeight;
      geo.maxY = document.documentElement.scrollHeight - window.innerHeight;
      settle();
    };
    measure();

    let raf = 0;
    let last = 0;
    let t = 0;
    let near = false;
    let settledAt = 0;
    let parked = false;

    const park = () => {
      const s = getAgentState();
      if (parked || s.requesting || s.executing || choreo.busy) return;
      parked = true;
      setAgentState({ ambient: true });
      void choreo
        .enqueue([
          { kind: "moveTo", target: agentId.cta("email"), scroll: false },
          { kind: "run", fn: () => label.current?.setAttribute("data-on", "") },
        ])
        .finally(() => setAgentState({ ambient: false }));
    };
    const unpark = () => {
      label.current?.removeAttribute("data-on");
      if (parked && getAgentState().ambient) choreo.cancel();
      parked = false;
      settledAt = 0;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      t += dt;
      const y = position();
      const { vw, vh } = geo;
      // 0 as contact's top meets the viewport bottom, 1 with the core centred
      // (or at the end of the page, if that comes first)
      const from = geo.secTop - vh;
      const to = Math.min(geo.cy - vh / 2, geo.maxY);
      const p = Math.min(1, Math.max(0, (y - from) / Math.max(1, to - from)));
      const cx = geo.cx;
      const cy = geo.cy - y;

      const finale = p > 0.5;
      if (getAgentState().finale !== finale) setAgentState({ finale });

      const far = Math.hypot(vw, vh) * 0.7;
      const fly = (sp: Spot, k: number, i: number) => {
        // from the viewport's edge along the slot's own direction, then a slow bob
        const a = Math.atan2(sp.dy, sp.dx);
        const sx = cx + Math.cos(a) * far;
        const sy = cy + Math.sin(a) * far;
        const bob = Math.sin(t * 0.6 + i * 1.7) * 5;
        return { x: sx + (cx + sp.dx - sx) * k, y: sy + (cy + sp.dy + bob - sy) * k };
      };
      imgs.forEach((el, i) => {
        const sp = imgSpots[i];
        const k = ease((p - i * 0.06) / 0.76);
        const { x, y: yy } = fly(sp, k, i);
        const rot = sp.rot + Math.sin(t * 0.4 + i) * 1.2;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg)`;
        el.style.opacity = sp.on ? (k * 0.85).toFixed(3) : "0";
      });
      tags.forEach((el, i) => {
        const sp = tagSpots[i];
        const k = ease((p - 0.3 - i * 0.05) / 0.5);
        const { x, y: yy } = fly(sp, k, i + 3);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = sp.on ? (k * 0.5).toFixed(3) : "0";
      });

      // settled: park the agent cursor on the email once
      if (p >= 1) {
        if (!settledAt) settledAt = now;
        else if (now - settledAt > SETTLE_MS) park();
      } else if (settledAt || parked) unpark();

      if (near && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || !near || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        root.toggleAttribute("data-near", near);
        if (near) start();
        else {
          stop();
          if (getAgentState().finale) setAgentState({ finale: false });
        }
      },
      { rootMargin: "50% 0px" }
    );
    io.observe(section);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      setAgentState({ finale: false });
    };
  }, []);

  return (
    <>
      <div ref={layer} className="finale-layer" aria-hidden="true">
        {images.map((im) => (
          <div key={im.slug} className="finale-img">
            <Image src={im.src} alt="" width={120} height={75} sizes="120px" />
          </div>
        ))}
        {skills.map((s) => (
          <span key={s} className="finale-skill label">
            {s}
          </span>
        ))}
      </div>
      <span ref={label} className="finale-copy-hint label" aria-hidden="true">
        click to copy
      </span>
    </>
  );
}

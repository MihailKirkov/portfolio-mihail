"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { choreo } from "@/lib/agent/choreo";
import { getAgentState, setAgentState } from "@/lib/agent/store";
import { agentId } from "@/lib/agent/targets";
import { position } from "@/lib/scroll";

// The finale (V3-PLAN Round 2, part 3). As contact scrolls in, the docked bar
// hides (store `finale`), the core flies to the large slot at the centre
// (CoreSlot "contact"), the project images fly in from the viewport's edges
// into a slow orbit round it, and a few skills drift in further out. All of
// it is a function of the Lenis scroll value, so scrolling back up plays it
// in reverse and the bar returns. Once it has settled the agent cursor parks
// on the email with a "click to copy" label.
//
// DOM transforms and opacity only; the loop runs only while contact is near
// the viewport and the tab is visible.

export interface FinaleItem {
  slug: string;
  src: string;
}

const ORBIT_SPEED = 0.09; // rad/s
const SKILL_SPEED = -0.04;
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

    // geometry in document coordinates, measured on resize
    const geo = { secTop: 0, cx: 0, cy: 0, coreW: 0, vw: 0, vh: 0, maxY: 0 };
    const measure = () => {
      const y = position();
      const s = section.getBoundingClientRect();
      const c = slot.getBoundingClientRect();
      geo.secTop = s.top + y;
      geo.cx = c.left + c.width / 2;
      geo.cy = c.top + c.height / 2 + y;
      geo.coreW = c.width;
      geo.vw = window.innerWidth;
      geo.vh = window.innerHeight;
      geo.maxY = document.documentElement.scrollHeight - window.innerHeight;
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
      const { vw, vh, coreW } = geo;
      // 0 as contact's top meets the viewport bottom, 1 with the core centred
      // (or at the end of the page, if that comes first)
      const from = geo.secTop - vh;
      const to = Math.min(geo.cy - vh / 2, geo.maxY);
      const p = Math.min(1, Math.max(0, (y - from) / Math.max(1, to - from)));
      const cx = geo.cx;
      const cy = geo.cy - y;

      const finale = p > 0.5;
      if (getAgentState().finale !== finale) setAgentState({ finale });

      const rx = Math.max(coreW * 0.75 + 150, Math.min(vw * 0.36, coreW * 1.4));
      const ry = rx * 0.26;
      const far = Math.hypot(vw, vh);
      imgs.forEach((el, i) => {
        const a = (i / imgs.length) * Math.PI * 2 + t * ORBIT_SPEED;
        const k = ease((p - i * 0.06) / 0.76);
        const ox = cx + rx * Math.cos(a);
        const oy = cy + ry * Math.sin(a);
        // from the viewport's edge along the image's own direction
        const sx = cx + Math.cos(a) * far * 0.7;
        const sy = cy + Math.sin(a) * far * 0.7;
        const depth = (Math.sin(a) + 1) / 2;
        const x = sx + (ox - sx) * k;
        const yy = sy + (oy - sy) * k;
        const sc = (0.78 + 0.3 * depth) * (0.7 + 0.3 * k);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
        el.style.opacity = (k * (0.55 + 0.45 * depth)).toFixed(3);
        el.style.zIndex = depth > 0.5 ? "2" : "0";
      });
      tags.forEach((el, i) => {
        const a = (i / tags.length) * Math.PI * 2 + 0.4 + t * SKILL_SPEED;
        const k = ease((p - 0.3 - i * 0.05) / 0.5);
        const r = rx * 1.3 + (1 - k) * 160;
        const x = cx + r * Math.cos(a);
        const yy = cy + r * 0.34 * Math.sin(a);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = (k * 0.55).toFixed(3);
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
            <Image src={im.src} alt="" width={176} height={110} sizes="176px" />
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import type { Content } from "@/lib/types";
import { buildSections, type SectionKey } from "@/lib/sections";
import { Stage } from "@/components/hud/stage";
import { MobileView } from "@/components/hud/mobile-view";
import { NodeModal } from "@/components/hud/node-modal";
import { Frame } from "@/components/hud/frame";
import type { Mode } from "@/components/hud/mode-tabs";

const STORAGE_KEY = "hud-mode";

export function HudRoot({ content }: { content: Content }) {
  const sections = useMemo(() => buildSections(content), [content]);
  const [open, setOpen] = useState<SectionKey | null>(null);
  // Default to the flight deck so the server render and first client render
  // match; the persisted choice is applied after mount (no hydration flash).
  const [mode, setMode] = useState<Mode>("deck");
  const scalerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // restore the persisted layout choice
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "visor" || saved === "deck" || saved === "reactor") {
      setMode(saved);
    }
  }, []);

  function changeMode(m: Mode) {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* storage unavailable — non-fatal */
    }
  }

  // Scale the 1080×632 stage to *fill* the viewport — fit both axes and scale
  // up (capped) so the composition reaches the bottom instead of packing at the
  // top. The viewport is exactly one screen tall, so nothing overflows.
  useEffect(() => {
    const STAGE_W = 1080;
    const STAGE_H = 632;
    const STRIP = 40; // status strip height (matches --strip-h)
    function scale() {
      const s = scalerRef.current;
      if (!s) return;
      // reserve the cockpit-frame inset + top status strip so the HUD sits
      // inside the frame (matches --frame-inset: clamp(12px, 2vw, 28px))
      const inset = Math.min(28, Math.max(12, window.innerWidth * 0.02));
      const availW = window.innerWidth - inset * 2 - 36;
      const availH = window.innerHeight - inset * 2 - STRIP - 28;
      const f = Math.min(availW / STAGE_W, availH / STAGE_H, 1.65);
      s.style.transform = `scale(${f})`;
    }
    scale();
    window.addEventListener("resize", scale);
    return () => window.removeEventListener("resize", scale);
  }, []);

  // Pointer-driven 3D tilt: map cursor position over the stage to --tiltX/--tiltY
  // (core parallax) and --ndx/--ndy (a few px of opposite node drift). Disabled
  // under prefers-reduced-motion.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const vp = viewportRef.current;
    const s = scalerRef.current;
    if (!vp || !s) return;

    const MAX_TILT = 12; // degrees
    function onMove(e: PointerEvent) {
      const r = vp!.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      s!.style.setProperty("--tiltY", `${px * MAX_TILT * 2}deg`);
      s!.style.setProperty("--tiltX", `${-py * MAX_TILT * 2}deg`);
    }
    function reset() {
      s!.style.setProperty("--tiltX", "0deg");
      s!.style.setProperty("--tiltY", "0deg");
    }
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerleave", reset);
    return () => {
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerleave", reset);
    };
  }, []);

  const activeSection = sections.find((s) => s.key === open) ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <Frame mode={mode} onChange={changeMode} />

      <div className="viewport" ref={viewportRef}>
        <div className="scaler" ref={scalerRef}>
          <Stage
            content={content}
            sections={sections}
            mode={mode}
            onOpen={setOpen}
          />
        </div>
      </div>

      <MobileView content={content} sections={sections} onOpen={setOpen} />

      <NodeModal section={activeSection} onClose={() => setOpen(null)} />
    </MotionConfig>
  );
}

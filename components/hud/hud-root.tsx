"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/types";
import { buildSections, type SectionKey } from "@/lib/sections";
import { FlightDeck } from "@/components/hud/flight-deck";
import { Visor } from "@/components/hud/visor";
import { Reactor } from "@/components/hud/reactor";
import { MobileView } from "@/components/hud/mobile-view";
import { NodeModal } from "@/components/hud/node-modal";
import { ModeTabs, type Mode } from "@/components/hud/mode-tabs";

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

  // scale the 1080×632 stage to fit the viewport width (clean, measured).
  useEffect(() => {
    function scale() {
      const s = scalerRef.current;
      const vp = viewportRef.current;
      if (!s || !vp) return;
      const f = Math.min(1, (window.innerWidth - 24) / 1080);
      s.style.transform = `scale(${f})`;
      vp.style.height = `${632 * f + 20}px`;
    }
    scale();
    window.addEventListener("resize", scale);
    return () => window.removeEventListener("resize", scale);
  }, []);

  const activeSection = sections.find((s) => s.key === open) ?? null;

  return (
    <>
      <ModeTabs mode={mode} onChange={changeMode} />

      <div className="viewport" ref={viewportRef}>
        <div className="scaler" ref={scalerRef}>
          {/* keying on mode replays the boot animation + gauge fills on switch */}
          <div className="layout" key={mode}>
            {mode === "visor" && (
              <Visor
                content={content}
                sections={sections}
                onOpen={setOpen}
                trigger={mode}
              />
            )}
            {mode === "deck" && (
              <FlightDeck
                content={content}
                sections={sections}
                onOpen={setOpen}
                trigger={mode}
              />
            )}
            {mode === "reactor" && (
              <Reactor content={content} sections={sections} onOpen={setOpen} />
            )}
          </div>
        </div>
      </div>

      <MobileView content={content} sections={sections} onOpen={setOpen} />

      <NodeModal section={activeSection} onClose={() => setOpen(null)} />
    </>
  );
}

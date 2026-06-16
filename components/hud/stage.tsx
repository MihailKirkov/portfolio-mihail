"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Content } from "@/lib/types";
import type { Section, SectionKey } from "@/lib/sections";
import type { Mode } from "@/components/hud/mode-tabs";
import { LAYOUTS, MORPH } from "@/lib/layout";
import { CssCore } from "@/components/hud/reactor-core";
import { Terminal } from "@/components/hud/terminal";
import { Brand, CvLink, Socials } from "@/components/hud/parts";
import { DeckChrome, VisorChrome, ReactorChrome } from "@/components/hud/chrome";

// One consolidated stage for all three modes. The core, six nodes and terminal
// are rendered ONCE and persist across modes — only their target boxes change,
// and framer-motion's `layout` tweens them from the old arrangement to the new
// (the morph). Mode-specific chrome fades in/out around them, staggered to land
// just after the nodes settle, so it reads as "the HUD reconfiguring".

export function Stage({
  content,
  sections,
  mode,
  onOpen,
}: {
  content: Content;
  sections: Section[];
  mode: Mode;
  onOpen: (key: SectionKey) => void;
}) {
  const layout = LAYOUTS[mode];
  const { profile } = content;
  const subOf = (key: SectionKey) =>
    sections.find((s) => s.key === key)?.sub ?? "";
  const labelOf = (key: SectionKey) =>
    sections.find((s) => s.key === key)?.label ?? key;

  return (
    <div className="stage">
      {/* persistent brand + top-right (CV + socials, identical in every mode;
          the deck-only spec pills live in DeckChrome) */}
      <Brand profile={profile} />
      <div className="topr" style={{ right: 0, top: 6 }}>
        <CvLink profile={profile} />
        <Socials profile={profile} />
      </div>

      {/* mode chrome — fades/scales in after the nodes settle, out quickly */}
      <AnimatePresence>
        <motion.div
          key={mode}
          className="chrome-layer"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: { duration: 0.4, delay: 0.44, ease: [0.2, 0.8, 0.2, 1] },
          }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {mode === "deck" && <DeckChrome content={content} />}
          {mode === "visor" && <VisorChrome content={content} />}
          {mode === "reactor" && <ReactorChrome />}
        </motion.div>
      </AnimatePresence>

      {/* persistent core — the anchor that resizes between modes */}
      <motion.div
        className="core"
        layout
        style={layout.core.style}
        transition={MORPH}
      >
        <CssCore
          rings={layout.core.rings}
          sweep
          label={layout.core.label}
          role={layout.core.role}
        />
      </motion.div>

      {/* persistent six nodes — glide + resize into each arrangement */}
      {sections.map((s) => {
        const box = layout.nodes[s.key];
        const cls = `node${box.right ? " r" : ""}${s.key === "ai" ? " ai" : ""}`;
        return (
          <motion.button
            key={s.key}
            className={cls}
            layout
            style={{ ...box.style, padding: "11px 13px" }}
            transition={MORPH}
            onClick={() => onOpen(s.key)}
          >
            <div>{labelOf(s.key)}</div>
            <div className="k">{subOf(s.key)}</div>
          </motion.button>
        );
      })}

      {/* persistent terminal — slides + reshapes; conversation state survives */}
      <motion.div
        className="panel term"
        layout
        style={layout.terminal}
        transition={MORPH}
      >
        <Terminal config={content.terminal} />
      </motion.div>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { SectionKey } from "@/lib/sections";
import type { Mode } from "@/components/hud/mode-tabs";

// Shared positioning system for the morphing HUD. The persistent elements (core,
// six nodes, terminal) keep the same identity across modes; only these target
// boxes change, and framer-motion tweens between them. All boxes are in stage
// coordinates (the 1080×632 stage). Right-side nodes are positioned with an
// explicit `left` (computed once) so every element animates the same property.

export interface NodeBox {
  style: CSSProperties;
  /** right-aligned chevron variant (.node.r) */
  right?: boolean;
}

export interface CoreSpec {
  style: CSSProperties;
  rings: 1 | 2 | 3;
  label: string;
  role?: string;
}

export interface ModeLayout {
  core: CoreSpec;
  terminal: CSSProperties;
  nodes: Record<SectionKey, NodeBox>;
}

// ~700ms spring glide with a gentle settle — the nodes/core/terminal morph.
export const MORPH = { type: "spring", duration: 0.7, bounce: 0.18 } as const;

export const LAYOUTS: Record<Mode, ModeLayout> = {
  deck: {
    core: {
      style: { left: 440, top: 58, width: 200, height: 200 },
      rings: 3,
      label: "M.K",
      role: "full-stack",
    },
    terminal: { left: 256, top: 296, width: 568, height: 298 },
    nodes: {
      identity: { style: { left: 250, top: 62, width: 168 } },
      experience: { style: { left: 262, top: 146, width: 168 } },
      stack: { style: { left: 250, top: 230, width: 168 } },
      projects: { style: { left: 662, top: 62, width: 168 }, right: true },
      ai: { style: { left: 650, top: 146, width: 168 }, right: true },
      credentials: { style: { left: 662, top: 230, width: 168 }, right: true },
    },
  },
  visor: {
    core: {
      style: { left: 476, top: 60, width: 128, height: 128 },
      rings: 3,
      label: "M.K",
    },
    terminal: { left: 208, top: 290, width: 664, height: 302 },
    nodes: {
      identity: { style: { left: 208, top: 172, width: 216 } },
      experience: { style: { left: 432, top: 172, width: 216 } },
      stack: { style: { left: 656, top: 172, width: 216 } },
      projects: { style: { left: 208, top: 230, width: 216 } },
      ai: { style: { left: 432, top: 230, width: 216 } },
      credentials: { style: { left: 656, top: 230, width: 216 } },
    },
  },
  reactor: {
    core: {
      style: { left: 462, top: 148, width: 156, height: 156 },
      rings: 3,
      label: "M.K.",
      role: "full-stack",
    },
    terminal: { left: 8, top: 420, width: 1064, height: 204 },
    nodes: {
      identity: { style: { left: 170, top: 88, width: 170 } },
      projects: { style: { left: 740, top: 88, width: 170 }, right: true },
      experience: { style: { left: 8, top: 202, width: 160 } },
      ai: { style: { left: 912, top: 202, width: 160 }, right: true },
      stack: { style: { left: 170, top: 316, width: 170 } },
      credentials: { style: { left: 740, top: 316, width: 170 }, right: true },
    },
  },
};

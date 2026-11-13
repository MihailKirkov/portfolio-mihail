"use client";

import { useSyncExternalStore } from "react";

// Shared agent state. `requesting` is set by the command bar while an answer is
// being produced, `executing` by the cursor engine while its queue is busy.
// The phase 4 core reads `agentStatus` to drive its uState uniform.

export type AgentStatus = "idle" | "thinking" | "executing";

interface AgentState {
  requesting: boolean;
  executing: boolean;
  /** active filter_projects tag, or null */
  filterTag: string | null;
  /** the command bar is docked (the hero panel has scrolled away); the core follows */
  docked: boolean;
  /** where the core rests while docked: the dock's slot, or an in-page spot
   *  (components/core/core-slot.tsx) claimed by the section in view */
  coreSpot: CoreSpot;
  /** the narrator woke the core after the visitor went idle: it turns
   *  toward the pointer and its rings speed up (components/site/narrator.tsx) */
  awake: boolean;
}

export type CoreSpot = "dock" | "contact" | "timeline" | "stack";

const INITIAL: AgentState = {
  requesting: false,
  executing: false,
  filterTag: null,
  docked: false,
  coreSpot: "dock",
  awake: false,
};

let state: AgentState = INITIAL;
const listeners = new Set<() => void>();

export function setAgentState(patch: Partial<AgentState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getAgentState() {
  return state;
}

export function subscribeAgentState(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAgentState<T>(select: (s: AgentState) => T): T {
  return useSyncExternalStore(
    subscribeAgentState,
    () => select(state),
    () => select(INITIAL)
  );
}

export function statusOf(s: AgentState): AgentStatus {
  if (s.executing) return "executing";
  if (s.requesting) return "thinking";
  return "idle";
}

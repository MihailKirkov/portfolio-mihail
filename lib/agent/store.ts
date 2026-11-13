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
}

export type CoreSpot = "dock" | "contact" | "timeline";

const INITIAL: AgentState = {
  requesting: false,
  executing: false,
  filterTag: null,
  docked: false,
  coreSpot: "dock",
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

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAgentState<T>(select: (s: AgentState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(INITIAL)
  );
}

export function statusOf(s: AgentState): AgentStatus {
  if (s.executing) return "executing";
  if (s.requesting) return "thinking";
  return "idle";
}

"use client";

import {
  MAX_ACTIONS_PER_REPLY,
  validateAction,
  type ActionCall,
} from "@/lib/agent/actions";
import { choreo, prefersReducedMotion, type Step } from "@/lib/agent/choreo";
import { resolveFirst } from "@/lib/agent/targets";

// Turns a reply's action calls into cursor steps: for each valid action the
// cursor flies to its target, clicks, THEN the effect fires. Invalid calls are
// rejected before anything runs.

export type ActionStatus = "queued" | "running" | "done" | "cancelled" | "rejected";

export interface ToolLogEntry {
  call: ActionCall;
  status: ActionStatus;
}

const PAUSE_AFTER_ACTION_MS = 320;

export function runActions(
  calls: ActionCall[],
  onUpdate: (log: ToolLogEntry[]) => void
): Promise<boolean> {
  const log: ToolLogEntry[] = calls.map((call, i) => ({
    call,
    status: i < MAX_ACTIONS_PER_REPLY && validateAction(call) ? "queued" : "rejected",
  }));
  const set = (i: number, status: ActionStatus) => {
    log[i] = { ...log[i], status };
    onUpdate([...log]);
  };
  onUpdate([...log]);

  const steps: Step[] = [];
  log.forEach((entry, i) => {
    if (entry.status === "rejected") return;
    const { def, params } = validateAction(entry.call)!;
    steps.push(
      { kind: "run", fn: () => set(i, "running") },
      { kind: "moveTo", target: () => resolveFirst(def.targets(params)) },
      { kind: "click" },
      {
        kind: "run",
        fn: async (signal) => {
          await def.run(params, { instant: prefersReducedMotion(), signal });
          // cut short by a cancel: left "running" so it is logged as cancelled
          if (!signal.aborted) set(i, "done");
        },
      },
      { kind: "wait", ms: PAUSE_AFTER_ACTION_MS }
    );
  });

  if (!steps.length) {
    // nothing valid to run: done instantly, without touching the engine
    return Promise.resolve(true);
  }

  return choreo.enqueue(steps).then((completed) => {
    if (!completed) {
      log.forEach((e, i) => {
        if (e.status === "queued" || e.status === "running") set(i, "cancelled");
      });
    }
    return completed;
  });
}

// Dev-only console hook for exercising actions by hand, e.g.
// __agent.run([{ name: "filter_projects", params: { tag: "Supabase" } }]).
// Stripped from production builds.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __agent: unknown }).__agent = {
    run: (calls: ActionCall[]) =>
      runActions(calls, (log) => console.table(log.map((e) => ({ ...e.call, status: e.status })))),
    cancel: () => choreo.cancel(),
  };
}

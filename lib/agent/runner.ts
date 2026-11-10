"use client";

import {
  MAX_ACTIONS_PER_REPLY,
  validateAction,
  type ActionCall,
} from "@/lib/agent/actions";
import { choreo, prefersReducedMotion, type Step } from "@/lib/agent/choreo";
import { resolveFirst } from "@/lib/agent/targets";

// Turns a reply's action calls into cursor steps: for each valid action the
// cursor flies to its target, clicks, THEN the effect fires. Invalid calls and
// anything past the per-reply cap are rejected before anything runs.

export type ActionStatus = "queued" | "running" | "done" | "cancelled" | "rejected";

export interface ToolLogEntry {
  call: ActionCall;
  status: ActionStatus;
}

const PAUSE_AFTER_ACTION_MS = 320;

export interface ActionRun {
  /** validate one call and queue it behind whatever is already playing */
  push(call: ActionCall): void;
  /** resolves once everything pushed so far has run; false if cancelled */
  settled(): Promise<boolean>;
}

/**
 * One reply's worth of actions, fed one call at a time so a streamed reply can
 * start moving the cursor while its text is still arriving. Once the visitor
 * cancels, nothing pushed later in the same reply runs either.
 */
export function startActionRun(onUpdate: (log: ToolLogEntry[]) => void): ActionRun {
  const log: ToolLogEntry[] = [];
  const pending: Promise<void>[] = [];
  let accepted = 0;
  let cancelled = false;

  const set = (i: number, status: ActionStatus) => {
    log[i] = { ...log[i], status };
    onUpdate([...log]);
  };

  return {
    push(call) {
      const i = log.length;
      const valid = accepted < MAX_ACTIONS_PER_REPLY ? validateAction(call) : null;
      log.push({ call, status: !valid ? "rejected" : cancelled ? "cancelled" : "queued" });
      onUpdate([...log]);
      if (!valid) return;
      accepted++;
      if (cancelled) return;

      const { def, params } = valid;
      const steps: Step[] = [
        { kind: "run", fn: () => set(i, "running") },
        { kind: "moveTo", target: () => resolveFirst(def.targets(params)) },
        { kind: "click" },
        {
          kind: "run",
          target: () => resolveFirst(def.lands?.(params) ?? def.targets(params)),
          fn: async (signal) => {
            await def.run(params, { instant: prefersReducedMotion(), signal });
            // cut short: a pause runs this step again if its target is still
            // on screen when the visitor stops scrolling; a cancel leaves it
            // "running" so it is logged as cancelled
            if (!signal.aborted) set(i, "done");
          },
        },
        { kind: "wait", ms: PAUSE_AFTER_ACTION_MS },
      ];
      pending.push(
        choreo.enqueue(steps).then((completed) => {
          if (completed) return;
          cancelled = true;
          if (log[i].status === "queued" || log[i].status === "running") set(i, "cancelled");
        })
      );
    },
    settled: () => Promise.all(pending).then(() => !cancelled),
  };
}

/** run a complete script (the canned chips) */
export function runActions(
  calls: ActionCall[],
  onUpdate: (log: ToolLogEntry[]) => void
): Promise<boolean> {
  const run = startActionRun(onUpdate);
  calls.forEach((call) => run.push(call));
  return run.settled();
}

/** calls that were accepted but did not finish: what "Show me" replays */
export function remainingCalls(log: ToolLogEntry[]): ActionCall[] {
  return log
    .filter((e) => e.status !== "done" && e.status !== "rejected")
    .map((e) => e.call);
}

/** run the unfinished calls of a log again, keeping its finished rows */
export function replayRemaining(
  log: ToolLogEntry[],
  onUpdate: (log: ToolLogEntry[]) => void
): Promise<boolean> {
  const kept = log.filter((e) => e.status === "done" || e.status === "rejected");
  return runActions(remainingCalls(log), (next) => onUpdate([...kept, ...next]));
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

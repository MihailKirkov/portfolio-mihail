"use client";

import { setAgentState, useAgentState } from "@/lib/agent/store";
import { applyProjectFilter } from "@/lib/agent/targets";

// Shows the active filter_projects tag with a way out. Renders nothing until
// the agent sets a filter, so the static page is unaffected.
export function ProjectFilter() {
  const tag = useAgentState((s) => s.filterTag);
  if (!tag) return null;

  function clear() {
    applyProjectFilter(null);
    setAgentState({ filterTag: null });
  }

  return (
    <div className="filter-bar" role="status">
      <span className="label">
        filter: <span className="filter-tag">{tag}</span>
      </span>
      <button type="button" className="btn" onClick={clear}>
        clear
      </button>
    </div>
  );
}

"use client";

export type Mode = "visor" | "deck" | "reactor";

export const MODES: { key: Mode; label: string }[] = [
  { key: "visor", label: "C1 · Visor" },
  { key: "deck", label: "C2 · Flight deck" },
  { key: "reactor", label: "C3 · Reactor" },
];

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = MODES.findIndex((m) => m.key === mode);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODES.length - 1;
    else return;
    e.preventDefault();
    onChange(MODES[next].key);
  }

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label="Layout mode"
      onKeyDown={onKeyDown}
    >
      <span className="lbl" aria-hidden="true">
        layout
      </span>
      {MODES.map((m) => {
        const selected = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            id={`tab-${m.key}`}
            aria-selected={selected}
            aria-controls="hud-stage"
            tabIndex={selected ? 0 : -1}
            className={`tab${selected ? " on" : ""}`}
            onClick={() => onChange(m.key)}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

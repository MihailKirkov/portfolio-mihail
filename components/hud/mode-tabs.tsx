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
  return (
    <div className="tabs" role="tablist" aria-label="Layout mode">
      <span className="lbl">layout</span>
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={mode === m.key}
          className={`tab${mode === m.key ? " on" : ""}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

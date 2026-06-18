// Stylized cold-blue HUD relocation map — Vienna → Eindhoven. Pure SVG, fully
// offline (no map-tile API, no external calls): a faint HUD grid, an abstract
// landmass, two labelled pins and a dashed trajectory arc. The arc march and pin
// pings are CSS-driven and stop static under prefers-reduced-motion.
export function LocationMap() {
  return (
    <svg
      className="geo"
      viewBox="0 0 300 150"
      role="img"
      aria-label="Relocation map — from Vienna, Austria to Eindhoven, Netherlands, September 2026"
    >
      <defs>
        <pattern
          id="geo-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M20 0H0V20"
            fill="none"
            stroke="var(--line)"
            strokeWidth="0.5"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="300" height="150" fill="url(#geo-grid)" />

      {/* abstract landmass — purely decorative HUD silhouette */}
      <path
        className="geo-land"
        d="M40 62 Q66 34 118 44 Q176 30 214 54 Q252 70 240 102 Q198 130 138 118 Q72 128 52 100 Z"
        aria-hidden="true"
      />

      {/* trajectory arc: Vienna -> Eindhoven */}
      <path className="geo-arc" d="M232 96 Q150 18 70 56" fill="none" />

      {/* Vienna pin (origin) */}
      <g className="geo-pin" aria-hidden="true">
        <circle className="geo-ring" cx="232" cy="96" r="4" />
        <circle cx="232" cy="96" r="3" />
        <text x="232" y="114" textAnchor="middle">
          Vienna, AT
        </text>
      </g>

      {/* Eindhoven pin (destination) */}
      <g className="geo-pin geo-dest" aria-hidden="true">
        <circle className="geo-ring" cx="70" cy="56" r="4" />
        <circle cx="70" cy="56" r="3" />
        <text x="70" y="44" textAnchor="middle">
          Eindhoven, NL
        </text>
      </g>

      <text className="geo-cap" x="150" y="143" textAnchor="middle">
        relocating · Sept 2026
      </text>
    </svg>
  );
}

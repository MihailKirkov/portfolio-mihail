// Cold-blue HUD competitive-programming stat dial - the RIGHT-flank twin of the
// chess dial, same 84px footprint and same `.sdial-*` skin. Replaces the mini
// skills radar that sat here: a multi-axis chart is illegible at this size with
// no room for axis labels, whereas a single figure reads instantly.
//
// The figure is a real fact (informatics from 2015-2020, national team 2019),
// so the dial is exposed to assistive tech via aria-label rather than aria-hidden.
// The arc is purely aesthetic (~70% fill) - not a percentile or ranking.

export function InformaticsDial() {
  const cx = 42;
  const cy = 46;
  const r = 28;
  const circ = 2 * Math.PI * r;
  // ~70% filled, matching the chess dial; cosmetic only.
  const fill = 0.7;

  return (
    <svg
      className="sdial overflow-visible"
      viewBox="0 0 84 84"
      role="img"
      aria-label="Competitive programming — 5+ years, Bulgarian national informatics team, two-time medalist"
      style={
        {
          ["--sdial-circ" as string]: `${circ}`,
          ["--sdial-offset" as string]: `${circ * (1 - fill)}`,
        } as React.CSSProperties
      }
    >
      {/* track */}
      <circle
        className="sdial-track"
        cx={cx}
        cy={cy}
        r={r}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* animated accent arc */}
      <circle
        className="sdial-arc"
        cx={cx}
        cy={cy}
        r={r}
        transform={`rotate(-90 ${cx} ${cy})`}
      />

      {/* trophy glyph, top-center - drawn rather than an emoji so it inherits
          the accent colour + glow instead of rendering as a colour bitmap */}
      <g className="sdial-mark" aria-hidden="true">
        {/* cup: straight rim, semicircular bowl */}
        <path d="M36 6 h12 v4 a6 6 0 0 1 -12 0 z" />
        {/* handles */}
        <path d="M36 7 h-3 a3 3 0 0 0 3 4" />
        <path d="M48 7 h3 a3 3 0 0 1 -3 4" />
        {/* stem + base */}
        <path d="M42 16 v3" />
        <path d="M38 20 h8" />
      </g>

      {/* center figure */}
      <text className="sdial-fig" x={cx} y={50} textAnchor="middle">
        5+
      </text>
      <text className="sdial-sub" x={cx} y={61} textAnchor="middle">
        years
      </text>
    </svg>
  );
}

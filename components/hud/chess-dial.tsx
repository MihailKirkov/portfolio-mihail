// Cold-blue HUD chess stat dial - pure SVG, no libraries. Drops into the Visor
// LEFT flank `.radar.live` frame. Sized to the same 84px footprint as the other
// live dials, and skinned by the shared `.sdial-*` styles it splits with the
// informatics dial on the right flank. It carries a real fact, so it is exposed
// to assistive tech via aria-label rather than aria-hidden.
//
// The arc is purely aesthetic (~70% fill) - not a percentile or ranking. It
// scales in on mount via stroke-dashoffset and is static under
// prefers-reduced-motion (the global reduced-motion rule disables the animation,
// leaving the filled final state defined by the base `.sdial-arc` style).

export function ChessDial() {
  const cx = 42;
  const cy = 46;
  const r = 28;
  const circ = 2 * Math.PI * r;
  // ~70% filled, leaving a gap at the bottom; cosmetic only.
  const fill = 0.7;

  return (
    <svg
      className="sdial overflow-visible"
      viewBox="0 0 84 84"
      role="img"
      aria-label="Chess - ~1800 FIDE, two-time national champion"
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

      {/* knight glyph, top-center */}
      <text className="sdial-glyph" x={cx} y={20} textAnchor="middle">
        {"♞"}
      </text>

      {/* center figure */}
      <text className="sdial-fig" x={cx} y={50} textAnchor="middle">
        1800
      </text>
      <text className="sdial-sub" x={cx} y={61} textAnchor="middle">
        FIDE
      </text>
    </svg>
  );
}

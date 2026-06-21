// Cold-blue HUD radar / spider chart. Pure SVG, no libraries. The value polygon
// scales in on open via CSS (.rc-poly) and is static under prefers-reduced-motion
// (the global reduced-motion rule disables the animation, leaving the final shape).
// Axes map 1:1 to the skill groups; values are the existing proficiency numbers.
//
// `mini` renders a label-less, compact variant sized to drop into the Visor
// flank dial (a ~104px circle). It is decorative there (aria-hidden) — the full
// labelled chart still lives in the Stack modal.

export interface RadarAxis {
  label: string;
  /** 0..100 */
  value: number;
}

export function SkillsRadar({
  axes,
  mini = false,
}: {
  axes: RadarAxis[];
  mini?: boolean;
}) {
  const cx = mini ? 52 : 110;
  const cy = mini ? 52 : 96;
  const R = mini ? 40 : 60;
  const n = axes.length;

  // vertex at axis i, radius r — first axis points straight up, then clockwise
  const pt = (i: number, r: number): readonly [number, number] => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const ring = (f: number) => axes.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const valuePts = axes.map((ax, i) => pt(i, R * (ax.value / 100)).join(",")).join(" ");

  if (mini) {
    return (
      <svg
        className="radar-chart mini overflow-visible"
        viewBox="0 0 104 104"
        aria-hidden="true"
      >
        <g className="rc-grid">
          {[0.5, 1].map((f) => (
            <polygon key={f} points={ring(f)} />
          ))}
          {axes.map((_, i) => {
            const [x, y] = pt(i, R);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} />;
          })}
        </g>
        <polygon className="rc-poly" points={valuePts} />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, R * (ax.value / 100));
          return <circle key={ax.label} className="rc-dot" cx={x} cy={y} r={1.8} />;
        })}
      </svg>
    );
  }

  return (
    <svg
      className="radar-chart overflow-visible"
      viewBox="0 0 220 200"
      role="img"
      aria-label={`Skills radar — ${axes
        .map((a) => `${a.label} ${a.value}%`)
        .join(", ")}`}
    >
      <g className="rc-grid" aria-hidden="true">
        {[0.5, 1].map((f) => (
          <polygon key={f} points={ring(f)} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} />;
        })}
      </g>

      <polygon className="rc-poly" points={valuePts} />

      {axes.map((ax, i) => {
        const [x, y] = pt(i, R * (ax.value / 100));
        return <circle key={ax.label} className="rc-dot" cx={x} cy={y} r={2.4} />;
      })}

      {axes.map((ax, i) => {
        const [x, y] = pt(i, R + 15);
        const anchor =
          Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
        return (
          <text
            key={ax.label}
            className="rc-lbl"
            x={x}
            y={y + 3}
            textAnchor={anchor}
            aria-hidden="true"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

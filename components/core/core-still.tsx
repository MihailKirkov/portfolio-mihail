import { CORE_STILL_VIEW, coreStill } from "@/lib/core/still";

// The static core: a server-rendered SVG of the shader core at idle. It is
// the SSR placeholder under the live core and the permanent fallback (reduced
// motion, phones, low-end devices, no WebGL). Its thinking and executing looks
// are a CSS recolour of the edge and ring groups (see globals.css).

export function CoreStill() {
  const { faces, edges, rings } = coreStill();
  const box = `0 0 ${CORE_STILL_VIEW} ${CORE_STILL_VIEW}`;
  return (
    <svg className="core-still" viewBox={box} aria-hidden="true" focusable="false">
      <g className="core-still-faces">
        {faces.map((p) => (
          <path key={p.color} d={p.d} fill={p.color} />
        ))}
      </g>
      <g className="core-still-edges" fill="none" strokeLinejoin="round">
        {edges.map((p) => (
          <path key={p.color} d={p.d} stroke={p.color} />
        ))}
      </g>
      <g className="core-still-rings" fill="none" strokeOpacity={0.9}>
        {rings.map((p, i) => (
          <path key={i} d={p.d} stroke={p.color} strokeWidth={p.width} />
        ))}
      </g>
    </svg>
  );
}

"use client";

// CSS-ring reactor core (the lightweight ambient version used as the constant
// anchor across modes). The Three.js core is layered on top in a later step and
// lazy-loaded so it never blocks first paint.

export function CssCore({
  size,
  rings = 1,
  sweep = false,
  label = "M.K",
  role,
}: {
  size: number;
  rings?: 1 | 2 | 3;
  sweep?: boolean;
  label?: string;
  role?: string;
}) {
  const hubInset = rings === 3 ? 54 : rings === 2 ? 22 : 22;
  return (
    <>
      {sweep && <div className="sweep" />}
      <div className="ring r1" />
      {rings >= 2 && <div className="ring r2" style={{ inset: 16 }} />}
      {rings >= 3 && <div className="ring r3" style={{ inset: 36 }} />}
      <div className="hub" style={{ inset: hubInset }}>
        <div className="nm">{label}</div>
        {role && <div className="rl">{role}</div>}
      </div>
    </>
  );
}

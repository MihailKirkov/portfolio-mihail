"use client";

// CSS-ring reactor core (the lightweight ambient version used as the constant
// anchor across modes). Each ring/hub sits on its own translateZ plane so the
// pointer-driven 3D tilt (see `.core3d` in globals.css, fed by --tiltX/--tiltY)
// produces real parallax depth. The Three.js core is layered on top in a later
// step and lazy-loaded so it never blocks first paint.

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
  const hubInset = rings === 3 ? 54 : 22;
  return (
    <div className="core3d">
      {sweep && <div className="sweep" />}
      <div className="clayer" style={{ transform: "translateZ(6px)" }}>
        <div className="ring r1" />
      </div>
      {rings >= 2 && (
        <div className="clayer" style={{ transform: "translateZ(26px)" }}>
          <div className="ring r2" style={{ inset: 16 }} />
        </div>
      )}
      {rings >= 3 && (
        <div className="clayer" style={{ transform: "translateZ(44px)" }}>
          <div className="ring r3" style={{ inset: 36 }} />
        </div>
      )}
      <div className="clayer" style={{ transform: "translateZ(64px)" }}>
        <div className="hub" style={{ inset: hubInset }}>
          <div className="nm">{label}</div>
          {role && <div className="rl">{role}</div>}
        </div>
      </div>
    </div>
  );
}

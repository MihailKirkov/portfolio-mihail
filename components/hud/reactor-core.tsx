"use client";

// CSS-ring reactor core (the lightweight ambient version used as the constant
// anchor across modes). Insets are percentages so the whole core scales cleanly
// at any size — important because framer-motion morphs the core's box between
// modes. Each ring/hub sits on its own translateZ plane so the pointer-driven
// 3D tilt (`.core3d`, fed by --tiltX/--tiltY) produces real parallax depth.

export function CssCore({
  rings = 3,
  sweep = true,
  label = "M.K",
  role,
}: {
  rings?: 1 | 2 | 3;
  sweep?: boolean;
  label?: string;
  role?: string;
}) {
  const hubInset = rings >= 3 ? "28%" : "16%";
  return (
    <div className="core3d">
      {sweep && <div className="sweep" />}
      <div className="clayer" style={{ transform: "translateZ(6px)" }}>
        <div className="ring r1" />
      </div>
      {rings >= 2 && (
        <div className="clayer" style={{ transform: "translateZ(26px)" }}>
          <div className="ring r2" style={{ inset: "9%" }} />
        </div>
      )}
      {rings >= 3 && (
        <div className="clayer" style={{ transform: "translateZ(44px)" }}>
          <div className="ring r3" style={{ inset: "19%" }} />
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

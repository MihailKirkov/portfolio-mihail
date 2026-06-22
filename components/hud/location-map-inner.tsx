"use client";

// Real, geographically accurate Vienna -> Eindhoven relocation map, styled in the
// cold-blue HUD language. Built from a locally bundled world-110m topojson
// (lib/geo/countries-110m.json) projected at render time with d3-geo — no
// map-tile API and no runtime network calls. This module is loaded lazily via
// next/dynamic (see location-map.tsx) so its ~100KB topojson never touches the
// first paint; it only ships when the Identity modal opens.
import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import topoData from "@/lib/geo/countries-110m.json";

// viewBox geometry — kept short/wide so both cities and the caption stay within
// the Identity modal's scroll viewport without needing to scroll. The `mini`
// variant (Visor flank dial) drops captions/labels and uses a squarer box so it
// nests inside a ~104px circular instrument.
const FULL = { W: 320, H: 150, PAD: 10 };
const MINI = { W: 104, H: 104, PAD: 14 };

// real city coordinates [lon, lat]
const VIENNA: [number, number] = [16.3738, 48.2082];
const EINDHOVEN: [number, number] = [5.4697, 51.4416];

// Western–Central Europe framing box [lon, lat] — frames NL/BE/DE/AT/CZ… so both
// cities sit in real geographic context without zooming to far-flung territory.
const REGION = {
  type: "Polygon" as const,
  coordinates: [[[2.4, 53.7], [18.4, 53.7], [18.4, 46.7], [2.4, 46.7], [2.4, 53.7]]],
};

// only draw countries that fall within (or border) the framed region — keeps the
// silhouette readable instead of rendering all 177 world features.
const SHOW = new Set([
  "Netherlands", "Belgium", "Luxembourg", "Germany", "Austria", "Czechia",
  "Switzerland", "France", "Poland", "Denmark", "Slovakia", "Slovenia",
  "Hungary", "Italy", "Croatia", "United Kingdom",
]);

type Topo = Parameters<typeof feature>[0];

export function LocationMapInner({ mini = false }: { mini?: boolean }) {
  const { W, H, PAD } = mini ? MINI : FULL;
  const { countries, arc, vienna, eindhoven } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [[PAD, PAD], [W - PAD, H - PAD]],
      REGION
    );
    const path = geoPath(projection);

    const fc = feature(topoData as unknown as Topo, (topoData as any).objects.countries);
    const features = (fc as any).features as Array<{
      properties: { name?: string };
    }>;
    const countries = features
      .filter((f) => f.properties?.name && SHOW.has(f.properties.name))
      .map((f) => ({ name: f.properties.name as string, d: path(f as any) }))
      .filter((c): c is { name: string; d: string } => Boolean(c.d));

    const [vx, vy] = projection(VIENNA) ?? [0, 0];
    const [ex, ey] = projection(EINDHOVEN) ?? [0, 0];

    // curved "flight-path" arc — quadratic bezier bowed northward (toward smaller y)
    const mx = (vx + ex) / 2;
    const my = (vy + ey) / 2;
    const dx = ex - vx;
    const dy = ey - vy;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const off = len * 0.26;
    const cx = mx + nx * off;
    const cy = my + ny * off;

    return {
      countries,
      arc: `M${vx.toFixed(2)},${vy.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(
        2
      )} ${ex.toFixed(2)},${ey.toFixed(2)}`,
      vienna: { x: vx, y: vy },
      eindhoven: { x: ex, y: ey },
    };
  }, [W, H, PAD]);

  return (
    <svg
      className={mini ? "geo geo-mini" : "geo"}
      viewBox={`0 0 ${W} ${H}`}
      role={mini ? undefined : "img"}
      aria-hidden={mini ? "true" : undefined}
      aria-label={
        mini
          ? undefined
          : "Relocation route from Vienna to Eindhoven — Vienna, Austria to Eindhoven, Netherlands, September 2026"
      }
    >
      <defs>
        <pattern id="geo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M20 0H0V20"
            fill="none"
            stroke="var(--line)"
            strokeWidth="0.5"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#geo-grid)" />

      {/* real country silhouettes — projected from bundled topojson */}
      <g aria-hidden="true">
        {countries.map((c) => (
          <path key={c.name} className="geo-country" d={c.d} />
        ))}
      </g>

      {/* trajectory arc: Vienna -> Eindhoven */}
      <path className="geo-arc" d={arc} fill="none" aria-hidden="true" />

      {/* Vienna pin (origin) */}
      <g className="geo-pin" aria-hidden="true">
        <circle className="geo-ring" cx={vienna.x} cy={vienna.y} r="4" />
        <circle cx={vienna.x} cy={vienna.y} r="2.5" />
        {!mini && (
          <text x={vienna.x} y={vienna.y + 14} textAnchor="middle">
            Vienna, AT
          </text>
        )}
      </g>

      {/* Eindhoven pin (destination) */}
      <g className="geo-pin geo-dest" aria-hidden="true">
        <circle className="geo-ring" cx={eindhoven.x} cy={eindhoven.y} r="4" />
        <circle cx={eindhoven.x} cy={eindhoven.y} r="2.5" />
        {!mini && (
          <text x={eindhoven.x} y={eindhoven.y - 9} textAnchor="middle">
            Eindhoven, NL
          </text>
        )}
      </g>

      {!mini && (
        <text className="geo-cap" x={W / 2} y={H - 7} textAnchor="middle">
          relocating · Sept 2026
        </text>
      )}
    </svg>
  );
}

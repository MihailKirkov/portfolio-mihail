"use client";

// Lazy entry point for the relocation map. The real map (location-map-inner)
// bundles a ~100KB topojson + d3-geo, so we defer it behind next/dynamic: the
// chunk is fetched only when this component actually mounts — i.e. when the
// Identity modal opens — keeping it off the first paint entirely.
import dynamic from "next/dynamic";

const LocationMapInner = dynamic(
  () => import("@/components/hud/location-map-inner").then((m) => m.LocationMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="geo geo-loading" role="img" aria-label="Loading relocation map" />
    ),
  }
);

export function LocationMap() {
  return <LocationMapInner />;
}

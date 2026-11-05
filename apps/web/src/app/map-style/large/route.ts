import { NextResponse, type NextRequest } from "next/server";
import type { StyleSpecification } from "maplibre-gl";
import base from "@/lib/map-style/gsi-large-text.json";
import { composeLargeStyle } from "@/lib/large-map-style";
import { terrainLayers } from "@/lib/map-settings";

// The 「大きい文字」 vector map style (lib/large-map-style.ts). The same for every visitor except for the terrain choice, so
// it is cached for an hour. Anything unknown in the address falls back to the defaults.
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const terrain = terrainLayers.find((t) => t === q.get("terrain")) ?? "hillshade";
  const opacity = Number(q.get("opacity"));
  const style = composeLargeStyle(base as unknown as StyleSpecification, {
    origin: request.nextUrl.origin,
    terrain,
    terrainOpacity: Number.isFinite(opacity) ? Math.min(0.8, Math.max(0.2, opacity)) : 0.5,
    terrainOn: q.get("on") === "1",
  });
  return NextResponse.json(style, { headers: { "Cache-Control": "public, max-age=3600" } });
}

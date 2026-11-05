import { NextResponse, type NextRequest } from "next/server";
import type { StyleSpecification } from "maplibre-gl";
import std from "@/lib/map-style/gsi-std.json";
import defaultEntries from "@/lib/map-style/gsi-large-text.entries.json";
import { applyEntries, type Entry, type StdLayer } from "@/lib/gsi-large-style";
import { composeLargeStyle } from "@/lib/large-map-style";
import { terrainLayers } from "@/lib/map-settings";
import { getLargeEntries } from "@/lib/site-settings";

// The 「大きい文字」 vector map style (lib/large-map-style.ts): GSI's style with the adjustments from the editor file (the
// ones an admin uploaded, else the built-in ones) and the sizes chosen in the site settings. The same for every visitor
// except for those choices, so it is cached for five minutes. Anything unknown in the address falls back to the defaults.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const terrain = terrainLayers.find((t) => t === q.get("terrain")) ?? "hillshade";
  const opacity = Number(q.get("opacity"));
  // Sizes from the address, kept inside the range the settings allow; anything else means as the style says.
  const scale = (name: string) => {
    const n = Number(q.get(name));
    return Number.isFinite(n) && q.has(name) ? Math.min(2, Math.max(0.8, n)) : 1;
  };
  const entries = (await getLargeEntries()) ?? (defaultEntries as Entry[]);
  const base = applyEntries(std as unknown as { layers: StdLayer[] }, entries).style;
  const style = composeLargeStyle(base as unknown as StyleSpecification, {
    origin: request.nextUrl.origin,
    terrain,
    terrainOpacity: Number.isFinite(opacity) ? Math.min(0.8, Math.max(0.2, opacity)) : 0.5,
    terrainOn: q.get("on") === "1",
    labelScale: scale("ls"),
    iconScale: scale("is"),
    lineScale: scale("ws"),
  });
  return NextResponse.json(style, { headers: { "Cache-Control": "public, max-age=300" } });
}

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { defaultMapSettings, type MapSettings } from "./map-settings";
import { mapStyle, terrainLayerId } from "./map";

// The 「大きい文字」 base map is a vector style (GSI's, with bigger text; lib/gsi-large-style.ts builds the file). A vector
// style is too big to write out in code like the raster ones, so the browser asks the server for it
// (app/map-style/large/route.ts) by an address that carries the terrain choice.

export const largeStylePath = "/map-style/large";

/** The address a map loads its style from. `terrainOn` is only for the settings preview, where the terrain can be shown at once. */
export function largeStyleUrl(settings: Pick<MapSettings, "terrain" | "terrainOpacity">, terrainOn = false): string {
  const q = new URLSearchParams({ terrain: settings.terrain, opacity: String(settings.terrainOpacity) });
  if (terrainOn) q.set("on", "1");
  return `${largeStylePath}?${q}`;
}

/** The style to hand to the map: a raster style as an object, the vector one as an address. */
export function mapStyleSource(settings: MapSettings = defaultMapSettings): StyleSpecification | string {
  return settings.base === "large" ? largeStyleUrl(settings) : mapStyle(settings);
}

/** GSI's vector style with our sprite and the terrain overlay (hidden until the visitor turns it on) under the labels. */
export function composeLargeStyle(base: StyleSpecification, opts: { origin: string; terrain: MapSettings["terrain"]; terrainOpacity: number; terrainOn: boolean }): StyleSpecification {
  const raster = mapStyle({ ...defaultMapSettings, terrain: opts.terrain, terrainOpacity: opts.terrainOpacity });
  const terrainSource = raster.sources["gsi-terrain"];
  const terrainLayer = raster.layers.find((l) => l.id === terrainLayerId) as LayerSpecification;
  if (!terrainSource || !terrainLayer) throw new Error("terrain layer missing");
  const layers = [...base.layers];
  // Under the first label or symbol, so names stay readable on the shading.
  const at = layers.findIndex((l) => l.type === "symbol");
  layers.splice(at === -1 ? layers.length : at, 0, { ...terrainLayer, layout: { visibility: opts.terrainOn ? "visible" : "none" } } as LayerSpecification);
  return { ...base, sprite: `${opts.origin}/map-style/sprite/std`, sources: { ...base.sources, "gsi-terrain": terrainSource }, layers };
}

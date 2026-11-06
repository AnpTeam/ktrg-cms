import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { defaultMapSettings, type MapSettings } from "./map-settings";
import { mapStyle, terrainLayerId } from "./map";

// The 「大きい文字」 base map is a vector style (GSI's, with bigger text; lib/gsi-large-style.ts builds the file). A vector
// style is too big to write out in code like the raster ones, so the browser asks the server for it
// (app/map-style/large/route.ts) by an address that carries the terrain choice.

export const largeStylePath = "/map-style/large";

/** The address a map loads its style from. `terrainOn` is only for the settings preview, where the terrain can be shown at once. */
export function largeStyleUrl(settings: Pick<MapSettings, "terrain" | "terrainOpacity" | "labelScale" | "iconScale" | "lineScale">, terrainOn = false): string {
  const q = new URLSearchParams({ terrain: settings.terrain, opacity: String(settings.terrainOpacity) });
  // Only what differs from the style, so the common address stays short and shared.
  if (settings.labelScale !== 1) q.set("ls", String(settings.labelScale));
  if (settings.iconScale !== 1) q.set("is", String(settings.iconScale));
  if (settings.lineScale !== 1) q.set("ws", String(settings.lineScale));
  if (terrainOn) q.set("on", "1");
  return `${largeStylePath}?${q}`;
}

/** The style to hand to the map: a raster style as an object, the vector one as an address. */
export function mapStyleSource(settings: MapSettings = defaultMapSettings, locale = "ja"): StyleSpecification | string {
  return settings.base === "large" ? largeStyleUrl(settings) : mapStyle(settings, locale);
}

/** GSI's vector style with our sprite and the terrain overlay (hidden until the visitor turns it on) under the labels. */
export function composeLargeStyle(
  base: StyleSpecification,
  opts: { origin: string; terrain: MapSettings["terrain"]; terrainOpacity: number; terrainOn: boolean; labelScale?: number; iconScale?: number; lineScale?: number },
): StyleSpecification {
  const raster = mapStyle({ ...defaultMapSettings, terrain: opts.terrain, terrainOpacity: opts.terrainOpacity });
  const terrainSource = raster.sources["gsi-terrain"];
  const terrainLayer = raster.layers.find((l) => l.id === terrainLayerId) as LayerSpecification;
  if (!terrainSource || !terrainLayer) throw new Error("terrain layer missing");
  const layers = scaleLayers(base.layers, opts.labelScale ?? 1, opts.iconScale ?? 1, opts.lineScale ?? 1);
  // Under the first label or symbol, so names stay readable on the shading.
  const at = layers.findIndex((l) => l.type === "symbol");
  layers.splice(at === -1 ? layers.length : at, 0, { ...terrainLayer, layout: { visibility: opts.terrainOn ? "visible" : "none" } } as LayerSpecification);
  return { ...base, sprite: `${opts.origin}/map-style/sprite/std`, sources: { ...base.sources, "gsi-terrain": terrainSource }, layers };
}

type Json = unknown;

/**
 * A size multiplied by `k`. A number, the outputs of a zoom interpolation or step, and the stops of the older style form are
 * scaled where they stand (a zoom expression must stay at the top, so it cannot be wrapped); any other expression is wrapped.
 */
export function scaleSize(v: Json, k: number): Json {
  if (typeof v === "number") return Math.round(v * k * 1000) / 1000;
  if (Array.isArray(v)) {
    if (v[0] === "interpolate" || v[0] === "interpolate-hcl" || v[0] === "interpolate-lab") return v.map((x, i) => (i >= 4 && i % 2 === 0 ? scaleSize(x, k) : x)); // [name, kind, input, z1, v1, z2, v2, ...]
    if (v[0] === "step") return v.map((x, i) => (i >= 2 && i % 2 === 0 ? scaleSize(x, k) : x)); // [name, input, v0, z1, v1, ...]
    return ["*", k, v];
  }
  if (typeof v === "object" && v !== null && Array.isArray((v as { stops?: unknown }).stops)) {
    return { ...v, stops: (v as { stops: Array<[number, Json]> }).stops.map(([z, value]) => [z, scaleSize(value, k)]) };
  }
  return v;
}

/** Names, icons and lines drawn larger or smaller. A scale of 1 leaves a layer exactly as it is. */
export function scaleLayers(layers: LayerSpecification[], label: number, icon: number, line: number): LayerSpecification[] {
  return layers.map((l) => {
    const layout = (l.layout ?? {}) as Record<string, Json>;
    const paint = (l.paint ?? {}) as Record<string, Json>;
    if (l.type === "symbol" && (label !== 1 || icon !== 1)) {
      const next = { ...layout };
      if (label !== 1 && next["text-size"] !== undefined) next["text-size"] = scaleSize(next["text-size"], label);
      if (icon !== 1 && next["icon-size"] !== undefined) next["icon-size"] = scaleSize(next["icon-size"], icon);
      return { ...l, layout: next } as LayerSpecification;
    }
    if (l.type === "line" && line !== 1 && paint["line-width"] !== undefined) return { ...l, paint: { ...paint, "line-width": scaleSize(paint["line-width"], line) } } as LayerSpecification;
    return l;
  });
}

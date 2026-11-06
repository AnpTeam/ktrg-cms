import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { defaultMapSettings, type MapSettings } from "./map-settings";

// Pure helpers for the trail map (WBS 3.2.1, 3.2.2). No DOM and no MapLibre runtime, so they
// are unit-tested. The map component (components/map/TrailMap.tsx) puts them together.

/** GSI (国土地理院) tile list: the credit must link here whenever tiles are loaded live. */
export const gsiTileListUrl = "https://maps.gsi.go.jp/development/ichiran.html";

/** Required credit for GSI tiles ("国土地理院" or "地理院タイル", linking to the tile list). */
export const gsiAttribution = `<a href="${gsiTileListUrl}" target="_blank" rel="noopener noreferrer">国土地理院（地理院タイル）</a>`;

/** Real tile ranges (checked on the GSI tile list): base map 5 to 18, relief 5 to 15, hillshade 2 to 16. */
export const zoomLimits = { min: 5, max: 18, reliefMax: 15, hillshadeMax: 16 } as const;

/** GSI's English map: the standard map with English names, for Japan as far as this zoom; closer in, GSI has only Japanese. */
export const englishMaxZoom = 11;

/** GSI's vector tiles (the data behind the 「大きい文字」 map), zoom 4 to 16. */
export const vectorTileUrl = "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf";

export const gsiTileUrl = (layer: "std" | "pale" | "blank" | "seamlessphoto" | "relief" | "hillshademap" | "english") =>
  `https://cyberjapandata.gsi.go.jp/xyz/${layer}/{z}/{x}/{y}.${layer === "seamlessphoto" ? "jpg" : "png"}`;

/** The GSI layer behind each base map choice, and the last zoom it has tiles for (beyond it the tiles are stretched). */
const baseTiles = {
  std: { layer: "std", maxzoom: 18 },
  pale: { layer: "pale", maxzoom: 18 },
  blank: { layer: "blank", maxzoom: 14 },
  photo: { layer: "seamlessphoto", maxzoom: 18 },
  // The vector map is drawn from its own style (lib/large-map-style.ts); this is only what the raster code falls back to.
  large: { layer: "std", maxzoom: 18 },
} as const;

export interface Position {
  lat: number;
  lng: number;
}

/** [west, south, east, north] of the points, or null for none. MapLibre order is lng, lat. */
export function boundsOf(points: readonly Position[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** A GeoJSON LineString through the points, in MapLibre's lng, lat order. */
export interface LineFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export function lineFeature(points: readonly Position[]): LineFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points.map((p): [number, number] => [p.lng, p.lat]) },
  };
}

/** OpenTopoMap (outdoor map: contours, trails, huts), free, from OpenStreetMap data; zoom 0 to 17. For the editor only: light use. */
export const topoTiles = ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`);
export const topoAttribution =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, SRTM | © <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (CC-BY-SA)';

/** The base maps an editor can switch between while mapping, and the style layer behind each. */
export const editorBases = ["std", "pale", "photo", "topo"] as const;
export type EditorBase = (typeof editorBases)[number];
export const editorBaseLayerIds: Record<EditorBase, string> = { std: "gsi-base", pale: "base-pale", photo: "base-photo", topo: "base-topo" };

/** Which layer shows for a choice: its own, and none of the others. */
export function editorBaseVisibility(choice: EditorBase): Record<string, "visible" | "none"> {
  return Object.fromEntries(editorBases.map((b) => [editorBaseLayerIds[b], b === choice ? "visible" : "none"]));
}

/**
 * The mapping style: the standard GSI map plus the other base maps as hidden layers, so switching is just showing one
 * of them (see editorBaseVisibility). Visitors never get this style.
 */
export function editorStyle(): StyleSpecification {
  const style = mapStyle({ ...defaultMapSettings, base: "std" });
  const raster = (tiles: string[], maxzoom: number, attribution: string) => ({ type: "raster" as const, tiles, tileSize: 256, minzoom: zoomLimits.min, maxzoom, attribution });
  const layer = (id: string, source: string): LayerSpecification => ({ id, type: "raster", source, layout: { visibility: "none" } });
  const at = style.layers.findIndex((l) => l.id === "gsi-base") + 1;
  style.layers.splice(at, 0, layer("base-pale", "base-pale"), layer("base-photo", "base-photo"), layer("base-topo", "base-topo"));
  return {
    ...style,
    sources: {
      ...style.sources,
      "base-pale": raster([gsiTileUrl("pale")], 18, gsiAttribution),
      "base-photo": raster([gsiTileUrl("seamlessphoto")], 18, gsiAttribution),
      "base-topo": raster(topoTiles, 17, topoAttribution),
    },
  };
}

/** The id of the layer behind the visitor's terrain button (shown or hidden, never removed). */
export const terrainLayerId = "gsi-terrain";

/**
 * The base map: GSI tiles (standard, pale, blank or photo), plus the terrain overlay (hidden until the visitor
 * turns it on). Raster tiles only. The overlay's tiles stop at their own maximum zoom, so they
 * are stretched beyond it.
 */
export function mapStyle(settings: MapSettings = defaultMapSettings, locale = "ja"): StyleSpecification {
  const terrainTiles = settings.terrain === "relief" ? gsiTileUrl("relief") : gsiTileUrl("hillshademap");
  const terrainMax = settings.terrain === "relief" ? zoomLimits.reliefMax : zoomLimits.hillshadeMax;
  const paint = { ...(settings.saturation !== 0 ? { "raster-saturation": settings.saturation } : {}), ...(settings.contrast !== 0 ? { "raster-contrast": settings.contrast } : {}) };
  // Over the two drawn maps: it is the standard map with other names, so it does not fit a photo or a blank map.
  const english = locale === "en" && (settings.base === "std" || settings.base === "pale");
  return {
    version: 8,
    sources: {
      "gsi-base": {
        type: "raster",
        tiles: [gsiTileUrl(baseTiles[settings.base].layer)],
        tileSize: 256,
        minzoom: zoomLimits.min,
        maxzoom: baseTiles[settings.base].maxzoom,
        attribution: gsiAttribution,
      },
      ...(english
        ? {
            "gsi-english": { type: "raster" as const, tiles: [gsiTileUrl("english")], tileSize: 256, minzoom: zoomLimits.min, maxzoom: englishMaxZoom, attribution: gsiAttribution },
          }
        : {}),
      "gsi-terrain": {
        type: "raster",
        tiles: [terrainTiles],
        tileSize: 256,
        minzoom: zoomLimits.min,
        maxzoom: terrainMax,
        attribution: gsiAttribution,
      },
    },
    layers: [
      // A calm colour shows where tiles have not arrived yet (weak signal), instead of a hole.
      { id: "background", type: "background", paint: { "background-color": "#dfe7e1" } },
      {
        id: "gsi-base",
        type: "raster",
        source: "gsi-base",
        // Calming the tiles: less colour and less contrast make the same map easier on the eyes (0 leaves them as drawn).
        paint,
      },
      ...(english ? [{ id: "gsi-english", type: "raster" as const, source: "gsi-english", maxzoom: englishMaxZoom + 1, paint }] : []),
      {
        id: terrainLayerId,
        type: "raster",
        source: "gsi-terrain",
        layout: { visibility: "none" },
        paint: { "raster-opacity": settings.terrainOpacity },
      },
    ],
  };
}

/**
 * The route line: a wide casing under a coloured line so it stays visible on any tile colour.
 * Dashed while it is only straight segments between stops (an approximation), solid for a real path.
 */
export function routeLineLayers(sourceId: string, approximate: boolean): LayerSpecification[] {
  return [
    {
      id: `${sourceId}-casing`,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 1 },
    },
    {
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { "line-cap": approximate ? "butt" : "round", "line-join": "round" },
      paint: {
        // Fixed colours on purpose: the map tiles do not change with the app theme, so the line
        // must read on them in both themes. A vivid orange with a thick white casing stands out on the pale tiles.
        "line-color": "#e8590c",
        "line-width": 6,
        ...(approximate ? { "line-dasharray": [2, 1.4] } : {}),
      },
    },
  ];
}

/**
 * Side trips (寄り道): a thin, blue, dashed line apart from the route's own, so a visitor can tell "a detour you may take"
 * from the way itself. Its source holds one LineString feature for each side trip.
 */
export function sideLineLayers(sourceId: string): LayerSpecification[] {
  return [
    { id: `${sourceId}-casing`, type: "line", source: sourceId, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 4.5, "line-opacity": 0.8 } },
    { id: `${sourceId}-line`, type: "line", source: sourceId, layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#1d4ed8", "line-width": 2.5, "line-dasharray": [2, 1.5] } },
  ];
}

export function sideLineCollection(lines: readonly (readonly Position[])[]): { type: "FeatureCollection"; features: LineFeature[] } {
  return { type: "FeatureCollection", features: lines.filter((l) => l.length >= 2).map(lineFeature) };
}

/**
 * How big the numbered pins are at a zoom, as a share of their full size: full from zoom 15 (walking), down to just over half
 * when the whole course is in view, so they do not cover the map when zoomed out.
 */
export const pinScale = (zoom: number): number => Math.min(1, Math.max(0.8, 0.8 + (zoom - 12) * 0.1));

/** Below this zoom the pins are small: their number chips are hidden (the picture still says what the place is). */
export const PIN_NUMBER_MIN_ZOOM = 13;

export type MarkerKind = "neutral" | "todo" | "next" | "stamped";

/** Which marker shape a stop gets. Signed out (stamped === null) is always neutral. */
export function markerKind(stamped: boolean | null, isNext: boolean): MarkerKind {
  if (stamped === null) return "neutral";
  if (stamped) return "stamped";
  return isNext ? "next" : "todo";
}

/** The first stop not yet stamped, for the "next" ring. null when signed out or all are stamped. */
export function nextStopId(all: readonly { id: string; stamped: boolean | null; noStamp?: boolean }[]): string | null {
  // A place without a stamp is never "next to stamp", and its missing state is not "signed out".
  const stops = all.filter((s) => !s.noStamp);
  if (stops.some((s) => s.stamped === null)) return null;
  return stops.find((s) => s.stamped === false)?.id ?? null;
}

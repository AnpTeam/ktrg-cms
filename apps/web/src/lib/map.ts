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

export const gsiTileUrl = (layer: "std" | "pale" | "relief" | "hillshademap") =>
  `https://cyberjapandata.gsi.go.jp/xyz/${layer}/{z}/{x}/{y}.png`;

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

/** The id of the layer behind the visitor's terrain button (shown or hidden, never removed). */
export const terrainLayerId = "gsi-terrain";

/**
 * The base map: GSI tiles (standard or pale), plus the terrain overlay (hidden until the visitor
 * turns it on). Raster tiles only. The overlay's tiles stop at their own maximum zoom, so they
 * are stretched beyond it.
 */
export function mapStyle(settings: MapSettings = defaultMapSettings): StyleSpecification {
  const terrainTiles = settings.terrain === "relief" ? gsiTileUrl("relief") : gsiTileUrl("hillshademap");
  const terrainMax = settings.terrain === "relief" ? zoomLimits.reliefMax : zoomLimits.hillshadeMax;
  return {
    version: 8,
    sources: {
      "gsi-base": {
        type: "raster",
        tiles: [gsiTileUrl(settings.base)],
        tileSize: 256,
        minzoom: zoomLimits.min,
        maxzoom: zoomLimits.max,
        attribution: gsiAttribution,
      },
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
      { id: "gsi-base", type: "raster", source: "gsi-base" },
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
      paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
    },
    {
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { "line-cap": approximate ? "butt" : "round", "line-join": "round" },
      paint: {
        // Fixed colours on purpose: the map tiles do not change with the app theme, so the line
        // must read on them in both themes (the colours match the accent pair).
        "line-color": "#8a3b00",
        "line-width": 5,
        ...(approximate ? { "line-dasharray": [2, 1.4] } : {}),
      },
    },
  ];
}

export type MarkerKind = "neutral" | "todo" | "next" | "stamped";

/** Which marker shape a stop gets. Signed out (stamped === null) is always neutral. */
export function markerKind(stamped: boolean | null, isNext: boolean): MarkerKind {
  if (stamped === null) return "neutral";
  if (stamped) return "stamped";
  return isNext ? "next" : "todo";
}

/** The first stop not yet stamped, for the "next" ring. null when signed out or all are stamped. */
export function nextStopId(stops: readonly { id: string; stamped: boolean | null }[]): string | null {
  if (stops.some((s) => s.stamped === null)) return null;
  return stops.find((s) => s.stamped === false)?.id ?? null;
}

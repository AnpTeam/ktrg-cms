import type { LayerSpecification } from "maplibre-gl";
import { legOf, type Leg, type Stop } from "./legs";
import type { LngLatEle } from "./line";

// What the map editor draws for the legs of a route: one feature for each pair of stops, so a leg can be told from the others
// (the chosen one is heavier, a pair without a leg is a thin dashed hop) and can be picked by clicking it. Pure.

export const LEG_SOURCE = "editor-legs";
/** A wide, invisible line over the legs: easy to hit with a click. */
export const LEG_HIT = `${LEG_SOURCE}-hit`;

export interface LegFeatureProps {
  /** The key of the leg's first stop: how a leg is named. "" for a track that is not cut into legs yet. */
  from: string;
  state: "drawn" | "missing";
  active: boolean;
}

export interface LegFeatures {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: LegFeatureProps; geometry: { type: "LineString"; coordinates: [number, number][] } }[];
}

const xy = (points: readonly (readonly (number | undefined)[])[]): [number, number][] => points.map((p) => [p[0]!, p[1]!]);

/**
 * The legs as map features. `preview` is a leg while one of its anchors is being dragged: it is shown instead of the saved one.
 * Without any pair of stops, `loose` (a track that has not been cut yet) is shown as one feature.
 */
export function legFeatures(
  pairs: readonly { from: Stop; to: Stop }[],
  legs: readonly Leg[],
  activeFrom: string | null,
  preview: { from: string; points: readonly LngLatEle[] } | null,
  loose: readonly LngLatEle[],
): LegFeatures {
  const features: LegFeatures["features"] = pairs.map(({ from, to }) => {
    const leg = legOf(legs, from.key, to.key);
    const points = preview && preview.from === from.key ? preview.points : leg ? leg.points : [[from.lng, from.lat], [to.lng, to.lat]];
    return { type: "Feature", properties: { from: from.key, state: leg || preview?.from === from.key ? "drawn" : "missing", active: from.key === activeFrom }, geometry: { type: "LineString", coordinates: xy(points) } };
  });
  if (pairs.length === 0 && loose.length >= 2) features.push({ type: "Feature", properties: { from: "", state: "drawn", active: false }, geometry: { type: "LineString", coordinates: xy(loose) } });
  return { type: "FeatureCollection", features };
}

const DRAWN = ["==", ["get", "state"], "drawn"] as const;

/** The layers for the legs source, bottom to top. Fixed colours: the map tiles do not change with the app theme. */
export function legLayers(): LayerSpecification[] {
  return [
    { id: `${LEG_SOURCE}-casing`, type: "line", source: LEG_SOURCE, filter: DRAWN as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-opacity": 0.9, "line-width": ["case", ["get", "active"], 11, 9] } },
    { id: `${LEG_SOURCE}-missing`, type: "line", source: LEG_SOURCE, filter: ["==", ["get", "state"], "missing"], layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#4b4b4b", "line-width": 3, "line-dasharray": [2, 1.6] } },
    { id: `${LEG_SOURCE}-line`, type: "line", source: LEG_SOURCE, filter: DRAWN as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", ["get", "active"], "#d22d1f", "#8a3b00"], "line-width": ["case", ["get", "active"], 7, 5] } },
    { id: LEG_HIT, type: "line", source: LEG_SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 18 } },
  ];
}

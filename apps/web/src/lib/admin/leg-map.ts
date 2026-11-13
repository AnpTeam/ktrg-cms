import type { LayerSpecification } from "maplibre-gl";
import { legOf, pairId, type Leg, type Stop } from "./legs";
import type { LngLatEle } from "./line";

// What the map editor draws for the legs of a route: one feature for each pair of stops, so a leg can be told from the others
// (the chosen one is heavier, a pair without a leg is a thin dashed hop) and can be picked by clicking it. Pure.

export const LEG_SOURCE = "editor-legs";
/** A wide, invisible line over the legs: easy to hit with a click. */
export const LEG_HIT = `${LEG_SOURCE}-hit`;

export interface LegFeatureProps {
  /** The key of the stop the leg runs to: how a leg is named (unique, also for a side trip). "" for a track that is not cut into legs yet. */
  id: string;
  state: "drawn" | "missing";
  active: boolean;
  /** A side trip (寄り道) out to a stop-by place: drawn thin, blue and dashed. */
  side: boolean;
}

export interface LegFeatures {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: LegFeatureProps; geometry: { type: "LineString"; coordinates: [number, number][] } }[];
}

const xy = (points: readonly (readonly (number | undefined)[])[]): [number, number][] => points.map((p) => [p[0]!, p[1]!]);

/**
 * The legs as map features. `preview` is a leg while one of its anchors is being dragged: it is shown instead of the saved one.
 * With no legs, `loose` (a line that has not been cut into legs) is shown as one feature.
 */
export function legFeatures(
  pairs: readonly { from: Stop; to: Stop; side?: true; back?: true }[],
  legs: readonly Leg[],
  activeId: string | null,
  preview: { id: string; points: readonly LngLatEle[] } | null,
  loose: readonly LngLatEle[],
): LegFeatures {
  // A line that is not cut into legs (it does not follow the stops) is shown as it is, and there are no legs to pick.
  if (legs.length === 0 && loose.length >= 2) {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: { id: "", state: "drawn", active: false, side: false }, geometry: { type: "LineString", coordinates: xy(loose) } }] };
  }
  const features: LegFeatures["features"] = pairs.map(({ from, to, side, back }) => {
    const id = pairId({ from, to, back });
    const leg = legOf(legs, from.key, to.key);
    const points = preview && preview.id === id ? preview.points : leg ? leg.points : [[from.lng, from.lat], [to.lng, to.lat]];
    // A return leg is drawn like a side trip (the second colour), so the way back is told from the way out.
    return { type: "Feature", properties: { id, state: leg || preview?.id === id ? "drawn" : "missing", active: id === activeId, side: !!side || !!back }, geometry: { type: "LineString", coordinates: xy(points) } };
  });
  return { type: "FeatureCollection", features };
}

const DRAWN = ["==", ["get", "state"], "drawn"] as const;
const MAIN_DRAWN = ["all", DRAWN, ["!", ["get", "side"]]] as const;
const SIDE_DRAWN = ["all", DRAWN, ["get", "side"]] as const;

/** The layers for the legs source, bottom to top. Fixed colours: the map tiles do not change with the app theme. */
export function legLayers(): LayerSpecification[] {
  return [
    { id: `${LEG_SOURCE}-casing`, type: "line", source: LEG_SOURCE, filter: MAIN_DRAWN as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-opacity": 0.9, "line-width": ["case", ["get", "active"], 12, 10] } },
    { id: `${LEG_SOURCE}-missing`, type: "line", source: LEG_SOURCE, filter: ["==", ["get", "state"], "missing"], layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#4b4b4b", "line-width": 3, "line-dasharray": [2, 1.6] } },
    { id: `${LEG_SOURCE}-line`, type: "line", source: LEG_SOURCE, filter: MAIN_DRAWN as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", ["get", "active"], "#d22d1f", "#6d28d9"], "line-width": ["case", ["get", "active"], 7, 5.5] } },
    { id: `${LEG_SOURCE}-side`, type: "line", source: LEG_SOURCE, filter: SIDE_DRAWN as never, layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": ["case", ["get", "active"], "#d22d1f", "#db2777"], "line-width": ["case", ["get", "active"], 4, 2.5], "line-dasharray": [2, 1.5] } },
    { id: LEG_HIT, type: "line", source: LEG_SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 18 } },
  ];
}

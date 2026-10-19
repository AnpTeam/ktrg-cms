import { simplify, type LngLatEle } from "./line";

// Choosing the points to send when a drawn line (or a row of stops) is snapped to walking trails. Pure.

/** The most points the route-finding service takes in one request. */
export const MAX_SNAP_POINTS = 50;
/** Fewer than this many points keeps the request light and the result close to what was drawn. */
const WANTED_POINTS = 25;

export interface SnapPoint {
  lat: number;
  lng: number;
}

/** The same line with positions rounded to 6 decimals (about 10 cm) and heights to one: the line editor refuses more. */
export function roundLine(line: readonly LngLatEle[]): LngLatEle[] {
  return line.map((p) => {
    const lng = Math.round(p[0] * 1e6) / 1e6;
    const lat = Math.round(p[1] * 1e6) / 1e6;
    return typeof p[2] === "number" ? [lng, lat, Math.round(p[2] * 10) / 10] : [lng, lat];
  });
}

/**
 * The points to snap through: the drawn line, thinned to a few points that keep its shape (the first and last stay);
 * or, when there is no line, the stops that have a position, in their order. Fewer than two usable points: null.
 */
export function snapPoints(line: readonly LngLatEle[], stops: readonly { lat: number | null; lng: number | null }[]): SnapPoint[] | null {
  if (line.length >= 2) {
    const thin = simplify(line, WANTED_POINTS);
    return thin.map((p) => ({ lat: p[1], lng: p[0] }));
  }
  const placed = stops.flatMap((s) => (s.lat !== null && s.lng !== null ? [{ lat: s.lat, lng: s.lng }] : []));
  if (placed.length < 2) return null;
  // Stops are few, but the limit is the limit.
  return placed.slice(0, MAX_SNAP_POINTS);
}

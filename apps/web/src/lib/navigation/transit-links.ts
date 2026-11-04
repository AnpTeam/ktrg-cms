// Hand-off links for getting to a course by train or bus (docs/navigation-transit-plan.md). We route nothing ourselves:
// the visitor opens another service, which has the real timetables. Only a CHECKED position is ever used (the API strips
// the rest), and only the station's own position is put in a link, never the visitor's.

import type { AccessPoint } from "../access-points";
import { distanceM, type LatLng, type LinePoint } from "./geometry";

export type TransitService = "google" | "yahoo";

/** The link for one service, or null when the entry has no checked position. */
export function transitLink(p: AccessPoint, service: TransitService): string | null {
  if (!p.checked || p.lat == null || p.lng == null) return null;
  if (service === "google") return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=transit`;
  // shortcut: Yahoo! マップ opens the station on its map (the visitor taps its route button there); a direct route link is
  // added when its address format is confirmed on a phone (plan, slice T4).
  return `https://map.yahoo.co.jp/place?lat=${p.lat}&lon=${p.lng}&zoom=17`;
}

/** The two ends of a course: its line's first and last point, or with no line its first and last stop. Null with fewer than two. */
export function courseEnds(model: { line: readonly LinePoint[]; stops: readonly LatLng[] }): { start: LatLng; end: LatLng } | null {
  if (model.line.length >= 2) {
    const a = model.line[0]!;
    const b = model.line[model.line.length - 1]!;
    return { start: { lng: a[0], lat: a[1] }, end: { lng: b[0], lat: b[1] } };
  }
  return model.stops.length >= 2 ? { start: model.stops[0]!, end: model.stops[model.stops.length - 1]! } : null;
}

/** Which end of the course the visitor is nearer to. Ends are the line's ends, or the first and last stop with no line. */
export function nearerEnd(ends: { start: LatLng; end: LatLng } | null, at: LatLng): "start" | "end" | null {
  if (!ends) return null;
  return distanceM(at, ends.start) <= distanceM(at, ends.end) ? "start" : "end";
}

/** Entries that serve the end the visitor is nearer to come first, then "either" or unsaid, then the other end. Order is otherwise kept. */
export function sortAccess<T extends Pick<AccessPoint, "serves">>(points: readonly T[], near: "start" | "end" | null): T[] {
  const rank = (p: T) => (near !== null && p.serves === near ? 0 : p.serves === "start" || p.serves === "end" ? 2 : 1);
  return points.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
}

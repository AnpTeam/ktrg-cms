// The maths of navigating a route spot to spot, with no React, no browser and no network, so it is unit-tested.
//
// A route line is a list of [lng, lat] points. The stops (stamp places) are ordered along it. A LEG is the part of the
// line between one stop and the next (the first leg starts at the start of the line). Legs are not stored: they are
// cut here from the one verified line (CLAUDE.md, navigation; the user chose this on 2026-10-20). Nothing here keeps
// or sends the visitor's position.

export type LinePoint = readonly [lng: number, lat: number, ele?: number];
export interface LatLng {
  lat: number;
  lng: number;
}
export interface Stop extends LatLng {
  id: string;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** A stop further than this from the line cannot be placed on it: that leg is "unreliable". */
export const STOP_MAX_OFF_LINE_M = 60;
/** A fix this far from the current leg counts as off route (three in a row, see `offRouteStep`). */
export const OFF_ROUTE_M = 40;
export const OFF_ROUTE_FIXES = 3;

/** Great-circle distance in metres (same formula as apps/api/src/lib/geo.ts). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const at = (p: LinePoint): LatLng => ({ lng: p[0], lat: p[1] });

/** Distance from the start of the line to each point, in metres. `[0, ...]`, as long as the line. */
export function cumulativeDistances(line: readonly LinePoint[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1]! + distanceM(at(line[i - 1]!), at(line[i]!)));
  return out;
}

export interface Projection {
  /** Metres from the start of the line to the nearest point on it. */
  alongM: number;
  /** Metres from the given point to that nearest point. */
  offM: number;
}

/**
 * The nearest point on the line to `p`, looking only at the part of the line between `fromM` and `toM` (along the
 * line). A route that doubles back passes near the same spot twice; the window keeps a fix or a stop on the right pass.
 * Returns null for a line with fewer than two points or an empty window.
 * shortcut: scans every segment in the window, which is microseconds for a few thousand points; use a segment index
 * if lines ever reach hundreds of thousands of points or a fix is matched many times a second.
 */
export function projectOnLine(
  line: readonly LinePoint[],
  cum: readonly number[],
  p: LatLng,
  window: { fromM: number; toM: number } = { fromM: 0, toM: Number.POSITIVE_INFINITY },
): Projection | null {
  let best: Projection | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    if (cum[i + 1]! < window.fromM || cum[i]! > window.toM) continue;
    const a = line[i]!;
    const b = line[i + 1]!;
    // Flat local map around this segment: metres per degree of longitude shrink with latitude.
    const kx = ((EARTH_RADIUS_M * Math.PI) / 180) * Math.cos(toRad((a[1] + b[1]) / 2));
    const ky = (EARTH_RADIUS_M * Math.PI) / 180;
    const sx = (b[0] - a[0]) * kx;
    const sy = (b[1] - a[1]) * ky;
    const px = (p.lng - a[0]) * kx;
    const py = (p.lat - a[1]) * ky;
    const len2 = sx * sx + sy * sy;
    // Only the part of this segment inside the window counts, so a stop cannot snap back to a pass it already left.
    const segM = cum[i + 1]! - cum[i]!;
    const tLo = segM === 0 ? 0 : Math.max(0, (window.fromM - cum[i]!) / segM);
    const tHi = segM === 0 ? 1 : Math.min(1, (window.toM - cum[i]!) / segM);
    const t = len2 === 0 ? 0 : Math.max(tLo, Math.min(tHi, (px * sx + py * sy) / len2));
    const off = Math.hypot(px - t * sx, py - t * sy);
    if (!best || off < best.offM) best = { alongM: cum[i]! + t * (cum[i + 1]! - cum[i]!), offM: off };
  }
  return best;
}

export interface Leg {
  /** The stop this leg ends at. */
  toStopId: string;
  startM: number;
  endM: number;
  /** False when the stop is too far from the line, or out of order along it: the leg's numbers cannot be trusted. */
  reliable: boolean;
}

/**
 * Cut the line into one leg per stop, in the order the stops are given (their `sort_order`). Each stop is matched to
 * the line only AHEAD of the previous stop. A stop that cannot be placed ahead of the previous one within
 * STOP_MAX_OFF_LINE_M, or that sits much closer to an earlier part of the line, makes its leg unreliable.
 */
export function cutLegs(line: readonly LinePoint[], cum: readonly number[], stops: readonly Stop[]): Leg[] {
  const legs: Leg[] = [];
  let prevEnd = 0;
  for (const stop of stops) {
    const ahead = projectOnLine(line, cum, stop, { fromM: prevEnd, toM: Number.POSITIVE_INFINITY });
    const anywhere = projectOnLine(line, cum, stop);
    if (!ahead || !anywhere) {
      legs.push({ toStopId: stop.id, startM: prevEnd, endM: prevEnd, reliable: false });
      continue;
    }
    const outOfOrder = anywhere.offM + STOP_MAX_OFF_LINE_M < ahead.offM; // far better match behind the previous stop
    legs.push({ toStopId: stop.id, startM: prevEnd, endM: ahead.alongM, reliable: ahead.offM <= STOP_MAX_OFF_LINE_M && !outOfOrder });
    prevEnd = ahead.alongM;
  }
  return legs;
}

/**
 * Index of the stop to head for: the NEAREST one (straight line) not yet stamped and not closed, so a visitor can join
 * the course anywhere and walk it either way (the user's rule, 2026-10-20). Null when none are left.
 */
export function nearestTarget(
  stops: readonly (Stop & { status?: "open" | "caution" | "closed" })[],
  stamped: ReadonlySet<string>,
  from: LatLng,
): number | null {
  let best: number | null = null;
  let bestM = Number.POSITIVE_INFINITY;
  stops.forEach((s, i) => {
    if (stamped.has(s.id) || s.status === "closed") return;
    const d = distanceM(from, s);
    if (d < bestM) {
      bestM = d;
      best = i;
    }
  });
  return best;
}

/** Off-route needs OFF_ROUTE_FIXES fixes in a row beyond OFF_ROUTE_M, so one bad fix does not flash the warning. */
export function offRouteStep(prevCount: number, offM: number): { count: number; offRoute: boolean } {
  const count = offM > OFF_ROUTE_M ? prevCount + 1 : 0;
  return { count, offRoute: count >= OFF_ROUTE_FIXES };
}

// ---- The "vector" to a point: how far, and which way -----------------------------------------------------------

/** The direction to walk from `from` to reach `to`, in degrees clockwise from north (0 to 360; 0 when they are equal). */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const f1 = toRad(from.lat);
  const f2 = toRad(to.lat);
  const dL = toRad(to.lng - from.lng);
  const y = Math.sin(dL) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dL);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Distance (haversine) and direction from one point to another. */
export function vectorTo(from: LatLng, to: LatLng): { distanceM: number; bearingDeg: number } {
  return { distanceM: distanceM(from, to), bearingDeg: bearingDeg(from, to) };
}

export const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** The nearest of the eight compass points to a bearing (any number of degrees, also negative). */
export function compassPoint(deg: number): CompassPoint {
  return COMPASS_POINTS[(((Math.round(deg / 45) % 8) + 8) % 8)]!;
}

/** The point `alongM` metres from the start of the line (clamped to its ends); null for an empty line. */
export function pointAlong(line: readonly LinePoint[], cum: readonly number[], alongM: number): LatLng | null {
  if (line.length === 0) return null;
  if (line.length === 1 || alongM <= 0) return at(line[0]!);
  const end = cum[cum.length - 1]!;
  if (alongM >= end) return at(line[line.length - 1]!);
  let i = 0;
  while (i + 2 < line.length && cum[i + 1]! < alongM) i++;
  const segM = cum[i + 1]! - cum[i]!;
  const t = segM === 0 ? 0 : (alongM - cum[i]!) / segM;
  const a = line[i]!;
  const b = line[i + 1]!;
  // Straight between two points of the line: they are metres apart, so a flat in-between is exact enough.
  return { lng: a[0] + t * (b[0] - a[0]), lat: a[1] + t * (b[1] - a[1]) };
}

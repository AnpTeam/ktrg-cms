import type { RouteDetail, RoutePoint, SpotListItem } from "./content";
import { cumulativeDistances, distanceM, type LinePoint, projectOnLine } from "./navigation/geometry";
import { distanceMeters } from "./places";
import type { PointKind } from "./point-kinds";
import type { WalkStyle } from "./walk-style";

// The places of a route as a visitor reads them: the stamp places and the other places worth a visit (a toilet, a rest
// area, a station ...) in one list, in the order of the walk, and where the walk starts and ends. Pure, so the route page,
// the admin's preview and the tests share one rule.

/** Waypoints that only guide the way: they stay on the map as plain marks but are not somewhere to go. */
const GUIDANCE_ONLY: readonly PointKind[] = ["turn", "danger"];
export const isGuidanceOnly = (kind: PointKind) => GUIDANCE_ONLY.includes(kind);

/** With no style saved, a goal farther than this from the start is called one-way; a closer one is left unsaid. */
export const FAR_GOAL_M = 300;

/** `number` is the stamp place's number along the walk (1 to N); places without a stamp and side trips (寄り道) have none. */
export type TrailStop = { type: "stamp"; spot: SpotListItem; number: number | null } | { type: "point"; point: RoutePoint; number: number | null };

export function trailStops(route: Pick<RouteDetail, "spots" | "points">): TrailStop[] {
  const stops: { order: number; stop: TrailStop }[] = [
    ...route.spots.map((spot, i) => ({ order: spot.sortOrder ?? i, stop: { type: "stamp", spot, number: null } as TrailStop })),
    ...route.points
      .filter((point) => !GUIDANCE_ONLY.includes(point.kind))
      .map((point, i) => ({ order: point.sortOrder ?? route.spots.length + i, stop: { type: "point", point, number: null } as TrailStop })),
  ];
  // Array.sort is stable, so equal orders keep the stamp places first. Numbers follow the walk, counting only stamp places that are not side trips.
  let n = 0;
  return stops
    .sort((a, b) => a.order - b.order)
    .map(({ stop }) => ({ ...stop, number: isSideTrip(stop) || stop.type === "point" ? null : ++n }) as TrailStop);
}

const positionOf = (stop: TrailStop) => (stop.type === "stamp" ? stop.spot.position : stop.point.position);
function isSideTrip(stop: TrailStop) {
  return (stop.type === "stamp" ? stop.spot.stopBy : stop.point.stopBy) === true;
}

export interface Journey {
  start: TrailStop;
  /** null when the route has only one place to name. */
  goal: TrailStop | null;
  /** What the admin saved; with none saved, "one_way" only when the goal is clearly far from the start, else null. */
  style: WalkStyle | null;
  /** For an out-and-back walk: the place farthest from the start, where the walk turns round. */
  turnaround: TrailStop | null;
}

/** Where the walk starts and ends: the first and last place along the way (side trips are not on the way). */
export function journeyOf(stops: readonly TrailStop[], saved: WalkStyle | null = null): Journey | null {
  const along = stops.filter((s) => !isSideTrip(s));
  const start = along[0];
  if (!start) return null;
  const goal = along.length > 1 ? along[along.length - 1]! : null;
  const a = positionOf(start);
  const b = goal ? positionOf(goal) : null;
  const far = a !== null && b !== null && distanceMeters(a, b) > FAR_GOAL_M;
  const style = saved ?? (far ? "one_way" : null);

  let turnaround: TrailStop | null = null;
  if (style === "out_and_back" && a) {
    let best = 0;
    for (const s of along.slice(1)) {
      const p = positionOf(s);
      const d = p ? distanceMeters(a, p) : 0;
      if (d > best) {
        best = d;
        turnaround = s;
      }
    }
  }
  return { start, goal, style, turnaround };
}

/** What a stop is to the walk: where it starts, where it ends, or both at once (a round trip begins and ends in one place). */
export type StopRole = "start" | "goal" | "both";

/**
 * The start and end of a walk by stop id, for the map's pin colours. Matches how the page words it: a round trip or an
 * out-and-back names one start/goal place (and an out-and-back's turnaround is a goal); anything else has a start and a goal.
 */
export function stopRoles(journey: Journey | null): Map<string, StopRole> {
  const roles = new Map<string, StopRole>();
  if (!journey) return roles;
  const id = (s: TrailStop) => (s.type === "stamp" ? s.spot.id : s.point.id);
  const startOnly = journey.style === "loop" || journey.style === "out_and_back";
  roles.set(id(journey.start), startOnly ? "both" : "start");
  if (!startOnly && journey.goal) roles.set(id(journey.goal), "goal");
  if (journey.style === "out_and_back" && journey.turnaround) roles.set(id(journey.turnaround), "goal");
  return roles;
}

/** The spoken word for a stop's role, so the Start and Goal pins are not told apart by colour alone; null for an ordinary stop. */
export function roleLabel(role: StopRole | undefined, words: { start: string; goal: string }): string | null {
  return role === "both" ? `${words.start}・${words.goal}` : role === "start" ? words.start : role === "goal" ? words.goal : null;
}

/** One row of the walk as the route page lists it. */
export interface WalkRow {
  stop: TrailStop;
  /** Unique per row: a round trip lists its start twice (as the start and again as the goal). */
  key: string;
  role: "start" | "goal" | "turnaround" | null;
  /** Kilometres along the route line from the row before that is on the way; null when unknown or for a side trip. */
  legKm: number | null;
}

/** A stop farther than this from the drawn line is not measured along it (a station a short walk off the trail still is). */
const ROW_MAX_OFF_LINE_M = FAR_GOAL_M;

/**
 * The walk from start to goal: every stop in order, the start and goal marked, and a walk that comes back to its start
 * (a round trip or an out-and-back) ends with that same place again as the goal, so the list reads start → … → goal and
 * both rows lead to the one place. Each row on the way gets its distance from the row before, measured along the line.
 */
export function walkRows(stops: readonly TrailStop[], journey: Journey | null, line: readonly { lat: number; lng: number }[] | null): WalkRow[] {
  const idOf = (s: TrailStop) => (s.type === "stamp" ? s.spot.id : s.point.id);
  const back = journey?.style === "loop" || journey?.style === "out_and_back";
  const rows: WalkRow[] = stops.map((stop) => ({
    stop,
    key: idOf(stop),
    role: journey && stop === journey.start ? "start" : journey && !back && stop === journey.goal ? "goal" : journey?.turnaround === stop ? "turnaround" : null,
    legKm: null,
  }));
  if (journey && back) rows.push({ stop: journey.start, key: `${idOf(journey.start)}:goal`, role: "goal", legKm: null });

  const points: LinePoint[] = (line ?? []).map((p) => [p.lng, p.lat]);
  if (points.length < 2) return rows;
  const cum = cumulativeDistances(points);
  const total = cum[cum.length - 1]!;
  let prevM: number | null = null;
  for (const row of rows) {
    if (isSideTrip(row.stop)) continue;
    const pos = positionOf(row.stop);
    let atM: number | null = null;
    if (pos) {
      // The goal of a walk that comes back is the end of the line (its start projects onto both ends); any other stop is
      // looked for only ahead of the one before, so a line that passes a place twice picks the right pass.
      const closing = row.key.endsWith(":goal") && distanceM(pos, { lng: points[points.length - 1]![0], lat: points[points.length - 1]![1] }) <= ROW_MAX_OFF_LINE_M;
      const hit: { alongM: number; offM: number } | null = closing ? { alongM: total, offM: 0 } : projectOnLine(points, cum, pos, { fromM: prevM ?? 0, toM: Number.POSITIVE_INFINITY });
      if (hit && hit.offM <= ROW_MAX_OFF_LINE_M) atM = hit.alongM;
    }
    if (prevM !== null && atM !== null && atM > prevM) row.legKm = Math.round((atM - prevM) / 100) / 10;
    if (atM !== null) prevM = atM;
  }
  return rows;
}

/** The stamp number of each place along the walk by id (null for a side trip and for places without a stamp). */
export const stopNumbers = (route: Pick<RouteDetail, "spots" | "points">): Map<string, number | null> =>
  new Map(trailStops(route).map((s) => [s.type === "stamp" ? s.spot.id : s.point.id, s.number] as const));

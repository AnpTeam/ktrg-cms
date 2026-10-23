import type { RouteDetail, RoutePoint, SpotListItem } from "./content";
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

/** The stamp number of each place along the walk by id (null for a side trip and for places without a stamp). */
export const stopNumbers = (route: Pick<RouteDetail, "spots" | "points">): Map<string, number | null> =>
  new Map(trailStops(route).map((s) => [s.type === "stamp" ? s.spot.id : s.point.id, s.number] as const));

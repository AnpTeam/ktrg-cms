import type { MapScreenRoute, MapScreenStop } from "./map-screen";
import { groupOf, type PlaceGroup } from "./places";

// What the map tab can show, as buttons along its top: the courses, the sutra mounds, and the groups of places
// (toilets, shops ...). Pure functions, so they are tested without a map.

export type MapLayer = "courses" | "mounds" | "side" | PlaceGroup;

/** The groups that get a button. "Other" (turns, viewpoints, dangers) has none and is always shown. */
export const pillGroups = ["rest", "shops", "vending", "transport"] as const satisfies readonly PlaceGroup[];

/** At first the map looks as it always did: the courses, and the places along a course once it is zoomed in. */
export const defaultLayers: ReadonlySet<MapLayer> = new Set<MapLayer>(["courses", ...pillGroups, "other"]);

/** Every sutra mound that has a position visitors may see, with the course it is on. */
export function moundStops(routes: readonly MapScreenRoute[]): { route: MapScreenRoute; stop: MapScreenStop }[] {
  return routes.flatMap((route) => (route.stops ?? []).filter((s) => s.kind === "mound").map((stop) => ({ route, stop })));
}

/** The buttons to offer: a layer with nothing to show is left out, so no button does nothing. */
export function offeredLayers(routes: readonly MapScreenRoute[]): MapLayer[] {
  const groups = new Set(routes.flatMap((r) => r.points.map((p) => groupOf(p.category))));
  const hasSide = routes.some((r) => r.sideLines?.length);
  // Side trips (寄り道) are off at first: some places are worth a mention without being a stop on the way.
  return ["courses", ...(moundStops(routes).length > 0 ? (["mounds"] as const) : []), ...(hasSide ? (["side"] as const) : []), ...pillGroups.filter((g) => groups.has(g))];
}

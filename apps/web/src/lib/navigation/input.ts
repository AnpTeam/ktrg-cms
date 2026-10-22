import type { PublicRoute, PublicSpot } from "../api-content-types";
import type { MapScreenRoute } from "../map-screen";
import type { LinePoint } from "./geometry";
import { buildModel, type NavModel, type NavStop } from "./session";

/**
 * The navigation model for one route from what GET /routes/{id} sends. The API only sends a line a person has
 * checked (線を確認した) and a position a person has checked (位置を確認した), so what is missing here is missing
 * on purpose: no line gives a straight-line-only model, and a place without a position is not a stop.
 */
export function modelFromRoute(route: Pick<PublicRoute, "line">, spots: readonly PublicSpot[]): NavModel {
  const line: LinePoint[] = route.line ? route.line.coordinates : [];
  const stops: NavStop[] = spots
    .filter((s) => s.stampable && s.position !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ id: s.id, lat: s.position!.lat, lng: s.position!.lng, radiusM: s.radiusM, status: s.status }));
  return buildModel(line, stops);
}

// shortcut: the map's stops carry no check-in radius yet, so the stamp button is offered at the usual 50 m; the server
// still checks the place's own radius. Add radiusM to MapScreenStop when a place gets a different one.
const MAP_STOP_RADIUS_M = 50;

/** The navigation model for a course as the map page has it (MapScreenRoute): its line and its stops with positions. */
export function modelFromMapRoute(route: Pick<MapScreenRoute, "line" | "stops">): NavModel {
  const line: LinePoint[] = (route.line ?? []).map((p) => [p.lng, p.lat]);
  // Navigation heads for stamp places: a place with no stamp is on the map but is never its destination.
  const stops: NavStop[] = (route.stops ?? []).filter((s) => !s.noStamp).map((s) => ({ id: s.id, lat: s.position.lat, lng: s.position.lng, radiusM: MAP_STOP_RADIUS_M, status: s.status }));
  return buildModel(line, stops);
}

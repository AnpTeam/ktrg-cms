import type { PublicRoute, PublicSpot } from "../api-content-types";
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

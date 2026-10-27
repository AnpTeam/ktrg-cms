import type { PublicRallyDetail } from "./api-content-types";
import { distanceMeters } from "./places";

export type RallyPlace = PublicRallyDetail["places"][number];

/** How far off the phone's own position may be and still count: the server refuses readings worse than this (stamp-service MAX_ACCURACY_M). */
const SLACK_M = 100;

/**
 * The stamp place of a rally nearest to a position, among those the visitor does not hold yet, that are not closed and
 * have a checked position. `near` says whether it is close enough to be worth asking the server (inside its radius, with
 * room for the phone's own error); the server still decides. Null when nothing is left to stamp.
 */
export function nearestToStamp(
  at: { lat: number; lng: number },
  places: readonly RallyPlace[],
  held: ReadonlySet<string>,
): { place: RallyPlace; distanceM: number; near: boolean } | null {
  let best: { place: RallyPlace; distanceM: number } | null = null;
  for (const p of places) {
    if (held.has(p.id) || p.status === "closed" || p.lat === null || p.lng === null) continue;
    const distanceM = distanceMeters(at, { lat: p.lat, lng: p.lng });
    if (!best || distanceM < best.distanceM) best = { place: p, distanceM };
  }
  return best ? { ...best, near: best.distanceM <= best.place.radiusM + SLACK_M } : null;
}

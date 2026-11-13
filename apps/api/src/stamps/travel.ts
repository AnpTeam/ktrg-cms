import { distanceMeters, type LatLng } from "../lib/geo";

export type Fix = LatLng & { at: Date };

// A walker cannot be 200 m or more apart from the last stamp faster than this. Cars and trains can, so it only flags.
export const FAST_TRAVEL_KMH = 60;
export const FAST_TRAVEL_MIN_M = 200;

// Flag, never block (CLAUDE.md): true when the two stamps cannot be one walk. The order of the two times does not matter,
// because offline stamps reach the server in any order.
export function tooFast(a: Fix, b: Fix): boolean {
  const metres = distanceMeters(a, b);
  if (metres < FAST_TRAVEL_MIN_M) return false;
  const hours = Math.abs(a.at.getTime() - b.at.getTime()) / 3_600_000;
  return hours === 0 || metres / 1000 / hours > FAST_TRAVEL_KMH;
}

export type Flag = { flagged: boolean; flagReason: string | null };

/** The flag of a stamp once the walk from the visitor's previous stamp is taken into account (reasons are comma-joined). */
export function withTravel(flag: Flag, prev: Fix | null, here: Fix | undefined): Flag {
  if (!prev || !here || !tooFast(prev, here)) return flag;
  return { flagged: true, flagReason: flag.flagReason ? `${flag.flagReason},fast_travel` : "fast_travel" };
}

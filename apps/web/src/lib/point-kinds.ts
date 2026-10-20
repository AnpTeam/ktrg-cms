import type { PlaceCategory } from "./places";

// What a waypoint (a point on a route) can be. Whether visitors can stamp there is a separate switch (`stampable`), not a kind.
// The API holds the same list (apps/api/src/db/schema/content.ts, `spotKinds`). Pure, so the admin and the public pages share it.

export const pointKinds = [
  "temple",
  "mound",
  "view",
  "turn",
  "danger",
  "toilet",
  "rest_area",
  "drinking_water",
  "vending_machine",
  "bus_stop",
  "station",
  "parking",
  "other",
] as const;
export type PointKind = (typeof pointKinds)[number];

export const isPointKind = (v: unknown): v is PointKind => typeof v === "string" && (pointKinds as readonly string[]).includes(v);

/** The stamp switch a new waypoint starts with: on for a temple, a sutra mound, a viewpoint or "other"; off for the practical kinds. */
export const stampableByDefault = (kind: PointKind): boolean => kind === "temple" || kind === "mound" || kind === "view" || kind === "other";

/**
 * How a waypoint shows on the map when it has no stamp: toilets, rest areas, water, vending machines and transport use the
 * map's own place groups ("places nearby"); everything else goes under "other".
 */
export function categoryOfKind(kind: PointKind): PlaceCategory {
  switch (kind) {
    case "toilet":
    case "rest_area":
    case "drinking_water":
    case "vending_machine":
    case "bus_stop":
    case "station":
    case "parking":
      return kind;
    default:
      return "other";
  }
}

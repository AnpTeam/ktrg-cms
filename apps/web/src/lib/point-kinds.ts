import type { PlaceCategory } from "./places";

// What a point on a route can be. "stamp" is a stamp place; the others are the route's navigation points. The API holds the
// same list (apps/api/src/db/schema/content.ts, `spotKinds`). Pure, so the admin and the public pages share it.

export const pointKinds = [
  "stamp",
  "turn",
  "danger",
  "view",
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

/** The kinds a person can choose for a navigation point (everything but a stamp place). */
export const navigationKinds = pointKinds.filter((k): k is Exclude<PointKind, "stamp"> => k !== "stamp");

export const isPointKind = (v: unknown): v is PointKind => typeof v === "string" && (pointKinds as readonly string[]).includes(v);

/**
 * How a navigation point shows on the map: toilets, rest areas, water, vending machines and transport use the map's own
 * place groups ("places nearby"); a turn, a danger and a view have no group of their own and go under "other".
 */
export function categoryOfKind(kind: Exclude<PointKind, "stamp">): PlaceCategory {
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

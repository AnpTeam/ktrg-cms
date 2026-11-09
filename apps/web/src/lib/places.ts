// Places along the courses (shops, toilets, vending machines ...): the pure parts. Names, groups,
// distances. No data lives here: it comes from the CMS (sample data in development), and this file
// is safe to ship to the browser.

export const placeCategories = [
  "souvenir_shop",
  "restaurant",
  "cafe",
  "convenience_store",
  "toilet",
  "rest_area",
  "drinking_water",
  "vending_machine",
  "station",
  "bus_stop",
  "parking",
  "other",
] as const;
export type PlaceCategory = (typeof placeCategories)[number];

/** What a visitor turns on in the map: a few plain groups, toilets first (the most needed). */
export const placeGroups = ["rest", "shops", "vending", "transport", "other"] as const;
export type PlaceGroup = (typeof placeGroups)[number];

const groupByCategory: Record<PlaceCategory, PlaceGroup> = {
  toilet: "rest",
  rest_area: "rest",
  drinking_water: "rest",
  souvenir_shop: "shops",
  restaurant: "shops",
  cafe: "shops",
  convenience_store: "shops",
  vending_machine: "vending",
  station: "transport",
  bus_stop: "transport",
  parking: "transport",
  other: "other",
};

export const groupOf = (category: PlaceCategory): PlaceGroup => groupByCategory[category];

export const placeStatuses = ["open", "closed", "seasonal", "gone", "unknown"] as const;
export type PlaceStatus = "open" | "closed" | "seasonal" | "gone" | "unknown";

export interface Coord {
  lat: number;
  lng: number;
}

/** A place as the map and its list use it: the text is already in the visitor's language. */
export interface MapPlace {
  id: string;
  category: PlaceCategory;
  name: string;
  nameLang: "ja" | "en";
  /** Opening hours, closed days and a short description; null when not given. */
  hours: string | null;
  closedDays: string | null;
  description: string | null;
  status: PlaceStatus;
  position: Coord;
  /** False while the position is a draft nobody has checked on a map. */
  verified: boolean;
  /** The date (YYYY-MM-DD) someone last checked the details; null when unknown. */
  lastVerified: string | null;
  /** Where it is, a phone number and its website, when the directory has them. */
  address?: string | null;
  phone?: string | null;
  website?: string | null;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A distance a walker can use: whole tens of metres under a kilometre ("350 m", never "347 m"),
 * tenths of a kilometre above. Always "about": it is a straight line, not the walking distance.
 */
export function distanceLabel(meters: number): { amount: number; unit: "m" | "km" } {
  if (meters < 995) return { amount: Math.max(10, Math.round(meters / 10) * 10), unit: "m" };
  return { amount: Math.round(meters / 100) / 10, unit: "km" };
}

/** The items nearest first, each with its straight-line distance from `from`. */
export function sortByDistance<T extends { position: Coord }>(items: readonly T[], from: Coord): (T & { meters: number })[] {
  return items
    .map((item) => ({ ...item, meters: distanceMeters(from, item.position) }))
    .sort((a, b) => a.meters - b.meters);
}

/** How many places each group has (groups with none are left out, so no empty button is shown). */
export function groupCounts(places: readonly { category: PlaceCategory }[]): Partial<Record<PlaceGroup, number>> {
  const counts: Partial<Record<PlaceGroup, number>> = {};
  for (const p of places) {
    const g = groupOf(p.category);
    counts[g] = (counts[g] ?? 0) + 1;
  }
  return counts;
}

/**
 * The places the directory page lists: one group and one course when asked (either may be left out), never a place that
 * is gone (its own page still opens from an old link), by Japanese name.
 */
export function directoryList<T extends { category: PlaceCategory; routes: number[]; status: PlaceStatus; nameJa: string }>(
  places: readonly T[],
  pick: { group?: PlaceGroup; route?: number },
): T[] {
  return places
    .filter((p) => p.status !== "gone" && (!pick.group || groupOf(p.category) === pick.group) && (pick.route === undefined || p.routes.includes(pick.route)))
    .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
}

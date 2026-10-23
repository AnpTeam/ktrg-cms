// Choosing a place from the site's places directory (parking, toilets, stations ...) to put on a route as a waypoint.
// Pure, so it is tested without a browser.

import { distanceMeters, placeCategories, type Coord, type PlaceCategory } from "@/lib/places";
import { isPointKind, type PointKind } from "@/lib/point-kinds";

/** A directory place as GET /places sends it (only what the picker needs). */
export interface DirectoryPlace {
  id: string;
  category: string;
  nameJa: string;
  nameEn: string | null;
  lat: number;
  lng: number;
  address: string | null;
}

export interface DirectoryRow extends DirectoryPlace {
  /** Straight-line metres from the reference point; null when there is none. */
  meters: number | null;
}

/** The waypoint kind of a directory category: the same word where there is one (a shop or a cafe is "other"). */
export const kindOfCategory = (category: string): PointKind => (isPointKind(category) ? category : "other");

export const isCategory = (c: string): c is PlaceCategory => (placeCategories as readonly string[]).includes(c);

const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** The places that match the category and the words, nearest first when there is a point to measure from (else by name). */
export function pickList(places: readonly DirectoryPlace[], opts: { from: Coord | null; category: string; query: string; limit?: number }): DirectoryRow[] {
  const words = squash(opts.query);
  return places
    .filter((p) => (opts.category === "" || p.category === opts.category) && (words === "" || squash(`${p.nameJa}${p.nameEn ?? ""}${p.address ?? ""}`).includes(words)))
    .map((p) => ({ ...p, meters: opts.from ? distanceMeters(opts.from, { lat: p.lat, lng: p.lng }) : null }))
    .sort((a, b) => (a.meters !== null && b.meters !== null ? a.meters - b.meters : a.nameJa.localeCompare(b.nameJa, "ja")))
    .slice(0, opts.limit ?? 40);
}

// What needs an editor's attention: a short list of routes and waypoints with something missing, so nobody has to open
// every one to find out. Pure, so it is tested without a database.

import type { RouteRow, SpotRow } from "./content-types";

export type RouteIssue = "line_unchecked" | "no_line" | "no_english_name" | "no_photo";
export type SpotIssue = "no_photo" | "no_english_name" | "position_unchecked";

export interface AttentionRoute {
  id: string;
  nameJa: string;
  issues: RouteIssue[];
}
export interface AttentionSpot {
  id: string;
  routeId: string;
  routeNameJa: string;
  nameJa: string;
  published: boolean;
  issues: SpotIssue[];
}

const blank = (v: string | null | undefined) => !v || v.trim() === "";

export function attention(routes: readonly (Pick<RouteRow, "id" | "nameJa" | "nameEn" | "geometry" | "lineVerified" | "photoUrl"> & { spots: readonly Pick<SpotRow, "id" | "nameJa" | "nameEn" | "photoUrl" | "photos" | "positionVerified" | "lat" | "published">[] })[]): {
  routes: AttentionRoute[];
  spots: AttentionSpot[];
} {
  const outRoutes: AttentionRoute[] = [];
  const outSpots: AttentionSpot[] = [];
  for (const r of routes) {
    const issues: RouteIssue[] = [];
    if (!r.geometry) issues.push("no_line");
    else if (!r.lineVerified) issues.push("line_unchecked");
    if (blank(r.nameEn)) issues.push("no_english_name");
    if (blank(r.photoUrl)) issues.push("no_photo");
    if (issues.length > 0) outRoutes.push({ id: r.id, nameJa: r.nameJa, issues });
    for (const s of r.spots) {
      const spotIssues: SpotIssue[] = [];
      if (blank(s.photoUrl) && s.photos.length === 0) spotIssues.push("no_photo");
      if (blank(s.nameEn)) spotIssues.push("no_english_name");
      if (s.lat !== null && !s.positionVerified) spotIssues.push("position_unchecked");
      if (spotIssues.length > 0) outSpots.push({ id: s.id, routeId: r.id, routeNameJa: r.nameJa, nameJa: s.nameJa, published: s.published, issues: spotIssues });
    }
  }
  return { routes: outRoutes, spots: outSpots };
}

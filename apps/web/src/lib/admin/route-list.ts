import type { AdminRouteSummary, Prefecture } from "./types";

/** Where a route stands: nothing to show yet, places exist but none is public, or visitors can see places. */
export type RouteState = "soon" | "draft" | "published";

export function routeState(r: Pick<AdminRouteSummary, "spotCount" | "publishedSpotCount">): RouteState {
  if (r.publishedSpotCount > 0) return "published";
  return r.spotCount > 0 ? "draft" : "soon";
}

/** Routes matching a search text (either language) and, optionally, one prefecture. */
export function filterRoutes<T extends Pick<AdminRouteSummary, "nameJa" | "nameEn" | "prefecture">>(
  routes: readonly T[],
  query: string,
  prefecture: Prefecture | null,
): T[] {
  const q = query.trim().toLowerCase();
  return routes.filter(
    (r) => (prefecture === null || r.prefecture === prefecture) && (q === "" || r.nameJa.toLowerCase().includes(q) || (r.nameEn ?? "").toLowerCase().includes(q)),
  );
}

/** The ids with one moved a step earlier (-1) or later (+1); unchanged at either end or for an unknown id. */
export function moveId(ids: readonly string[], id: string, step: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const out = [...ids];
  [out[from], out[to]] = [out[to]!, out[from]!];
  return out;
}

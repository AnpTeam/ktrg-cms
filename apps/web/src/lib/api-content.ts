import type { PublicPlace, PublicRoute, PublicSpot } from "./api-content-types";
import type { TrailNotice } from "./notices";
import type { PlaceItem, Prefecture, RouteDetail, RoutePoint, RouteSummary, SpotDetail, SpotListItem } from "./content";
import { placeCategories, placeStatuses } from "./places";
import { isPointKind } from "./point-kinds";
import { areaFromBounds, sketchFromPoints } from "./route-geometry";
import type { Sketch } from "./sketch";

export { areaFromBounds, sketchFromPoints };

// Turns what the API sends (GET /routes, /routes/{id}, /spots/{id}) into the view-models the screens use, and
// fetches it on the server. Pure mappers first (unit-tested), then the fetchers. Server code only: it is on the
// client-boundary list, like the content module.

/** A sketch from the API's list answer, which has only [lng, lat] and is already short. */
function sketchFromList(sketch: [number, number][] | null): Sketch | null {
  return sketch && sketch.length >= 2 ? sketchFromPoints(sketch, 40) : null;
}

const prefectureOf = (p: string | null): Prefecture | null => (p === "osaka" || p === "wakayama" || p === "nara" ? p : null);

export function routeSummaryFromApi(r: PublicRoute, order: number): RouteSummary {
  return {
    id: r.id,
    order,
    status: r.status,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    prefecture: prefectureOf(r.prefecture),
    municipality: r.municipality,
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    difficulty: r.difficulty,
    expectedTimeMin: r.expectedTimeMin,
    sketch: sketchFromList(r.sketch),
    area: areaFromBounds(r.bounds),
    spotCount: r.publishedSpotCount,
    // Nobody has stamped a real place yet (stamping is not built); the viewer filter hides this when signed out.
    stampedCount: 0,
    photoUrl: r.photoUrl,
  };
}

export function spotListItemFromApi(s: PublicSpot): SpotListItem {
  return {
    id: s.id,
    nameJa: s.nameJa,
    nameEn: s.nameEn,
    status: s.status,
    ...(isPointKind(s.kind) ? { kind: s.kind } : {}),
    stamped: false,
    position: s.position ? { lat: s.position.lat, lng: s.position.lng, verified: true } : null,
  };
}

/** A directory place as the screens use it; `order` is its course's number (1 to 19), or null when it is on none. A category or status this app does not know is read as "other" / "unknown". */
export function placeItemFromApi(p: PublicPlace, order: number | null): PlaceItem {
  return {
    id: p.id,
    category: placeCategories.find((c) => c === p.category) ?? "other",
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    routes: order === null ? [] : [order],
    position: { lat: p.lat, lng: p.lng, verified: true },
    hoursJa: p.hoursJa,
    hoursEn: p.hoursEn,
    closedDaysJa: p.closedDaysJa,
    closedDaysEn: p.closedDaysEn,
    descriptionJa: p.descriptionJa,
    descriptionEn: p.descriptionEn,
    status: placeStatuses.find((s) => s === p.status) ?? "unknown",
    lastVerified: p.lastVerified,
  };
}

/** A waypoint without a stamp (a turn, a toilet ...); null for one with a stamp or a kind this app does not know. */
export function routePointFromApi(s: PublicSpot): RoutePoint | null {
  if (!isPointKind(s.kind) || s.stampable) return null;
  return {
    id: s.id,
    kind: s.kind,
    nameJa: s.nameJa,
    nameEn: s.nameEn,
    descriptionJa: s.descriptionJa,
    descriptionEn: s.descriptionEn,
    position: s.position ? { lat: s.position.lat, lng: s.position.lng, verified: true } : null,
  };
}

export function routeDetailFromApi(r: PublicRoute, spots: PublicSpot[], order: number, points: PublicSpot[] = []): RouteDetail {
  const line = r.line?.coordinates ?? null;
  return {
    ...routeSummaryFromApi(r, order),
    // The detail has the whole line, so its silhouette and elevation come from that.
    sketch: line ? sketchFromPoints(line) : null,
    descriptionJa: r.descriptionJa,
    descriptionEn: r.descriptionEn,
    historyJa: r.historyJa,
    historyEn: r.historyEn,
    accessJa: r.accessJa,
    accessEn: r.accessEn,
    spots: spots.map(spotListItemFromApi),
    points: points.flatMap((p) => routePointFromApi(p) ?? []),
    line: line ? line.map(([lng, lat]) => ({ lat, lng })) : null,
    videoUrl: r.videoUrl,
    photoUrl: r.photoUrl,
  };
}

export function spotDetailFromApi(s: PublicSpot, route: Pick<PublicRoute, "id" | "nameJa" | "nameEn">): SpotDetail {
  return {
    ...spotListItemFromApi(s),
    routeId: route.id,
    routeNameJa: route.nameJa,
    routeNameEn: route.nameEn,
    descriptionJa: s.descriptionJa,
    descriptionEn: s.descriptionEn,
    statusNoteJa: s.statusNoteJa,
    statusNoteEn: s.statusNoteEn,
    statusUpdatedAt: s.statusUpdatedAt,
    photoUrl: s.photoUrl,
  };
}

/** A course with nothing in it yet: no line, no published place, no text. Sample data may stand in for it. */
export function isEmptyRoute(r: Pick<PublicRoute, "bounds" | "publishedSpotCount" | "descriptionJa">): boolean {
  return r.bounds === null && r.publishedSpotCount === 0 && !r.descriptionJa;
}

// ---- fetching (server only) -----------------------------------------------------------------

const origin = () => process.env.API_ORIGIN ?? "http://localhost:3001";

async function getJson(path: string): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(`${origin()}/api/v1${path}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null; // the API is not reachable: the caller shows an empty state, never a crash
  }
}

const okBody = <T>(r: { status: number; body: unknown } | null): T | null =>
  r && r.status === 200 && (r.body as { ok?: unknown } | null)?.ok === true ? (r.body as T) : null;

export async function fetchPublicRoutes(): Promise<PublicRoute[] | null> {
  return okBody<{ routes: PublicRoute[] }>(await getJson("/routes"))?.routes ?? null;
}

export async function fetchPublicRoute(id: string): Promise<{ route: PublicRoute; spots: PublicSpot[]; points: PublicSpot[] } | null> {
  const body = okBody<{ route: PublicRoute; spots: PublicSpot[]; points?: PublicSpot[] }>(await getJson(`/routes/${encodeURIComponent(id)}`));
  return body ? { route: body.route, spots: body.spots, points: body.points ?? [] } : null;
}

export async function fetchPublicSpot(id: string): Promise<PublicSpot | null> {
  return okBody<{ spot: PublicSpot }>(await getJson(`/spots/${encodeURIComponent(id)}`))?.spot ?? null;
}

/** Published places of the directory (the API keeps back the ones without a checked position). */
export async function fetchPublicPlaces(): Promise<PublicPlace[] | null> {
  return okBody<{ places: PublicPlace[] }>(await getJson("/places"))?.places ?? null;
}

/** Published trail notices that have not expired (the API decides, in Japan time). */
export async function fetchPublicNotices(): Promise<TrailNotice[] | null> {
  return okBody<{ notices: TrailNotice[] }>(await getJson("/notices"))?.notices ?? null;
}

/** Published home page banners, in order. */
export async function fetchPublicBanners(): Promise<{ id: string; imageUrl: string; altJa: string; altEn: string | null }[] | null> {
  return okBody<{ banners: { id: string; imageUrl: string; altJa: string; altEn: string | null }[] }>(await getJson("/banners"))?.banners ?? null;
}

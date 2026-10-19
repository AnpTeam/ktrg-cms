import type { PublicRoute, PublicSpot } from "./api-content-types";
import type { Prefecture, RouteDetail, RouteSummary, SpotDetail, SpotListItem } from "./content";
import type { RouteArea } from "./map-screen";
import { downsample, normalizePoints, type Sketch } from "./sketch";

// Turns what the API sends (GET /routes, /routes/{id}, /spots/{id}) into the view-models the screens use, and
// fetches it on the server. Pure mappers first (unit-tested), then the fetchers. Server code only: it is on the
// client-boundary list, like the content module.

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_AT_EQUATOR = 111_320;
/** An area never gets smaller than this, so a short course is still a shape you can tap. */
const MIN_AREA_M = 1500;

type Point = readonly [lng: number, lat: number, ele?: number];

/** The box around a course, as the rectangle drawn on the overview map. */
export function areaFromBounds(b: PublicRoute["bounds"]): RouteArea | null {
  if (!b) return null;
  const lat = (b.south + b.north) / 2;
  const lng = (b.west + b.east) / 2;
  const widthM = Math.max(MIN_AREA_M, (b.east - b.west) * M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat * Math.PI) / 180));
  const heightM = Math.max(MIN_AREA_M, (b.north - b.south) * M_PER_DEG_LAT);
  return { lat, lng, widthM, heightM, verified: true };
}

/** A line as a 0..1 silhouette (north up); elevations ride along when the line has them. */
export function sketchFromPoints(points: readonly Point[], max = 40): Sketch | null {
  if (points.length < 2) return null;
  const kept = downsample(points, max);
  const midLat = kept.reduce((s, p) => s + p[1], 0) / kept.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const sketch: Sketch = { points: normalizePoints(kept.map((p) => [p[0] * k, -p[1]] as [number, number])) };
  const eles = kept.map((p) => p[2]);
  if (eles.every((e): e is number => typeof e === "number")) sketch.elevations = eles;
  return sketch;
}

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
  };
}

export function spotListItemFromApi(s: PublicSpot): SpotListItem {
  return {
    id: s.id,
    nameJa: s.nameJa,
    nameEn: s.nameEn,
    status: s.status,
    stamped: false,
    position: s.position ? { lat: s.position.lat, lng: s.position.lng, verified: true } : null,
  };
}

export function routeDetailFromApi(r: PublicRoute, spots: PublicSpot[], order: number): RouteDetail {
  const line = r.line?.coordinates ?? null;
  return {
    ...routeSummaryFromApi(r, order),
    // The detail has the whole line, so its silhouette and elevation come from that.
    sketch: line ? sketchFromPoints(line) : null,
    descriptionJa: r.descriptionJa,
    descriptionEn: r.descriptionEn,
    spots: spots.map(spotListItemFromApi),
    line: line ? line.map(([lng, lat]) => ({ lat, lng })) : null,
    videoUrl: r.videoUrl,
    photoUrl: null,
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
    photoUrl: null,
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

export async function fetchPublicRoute(id: string): Promise<{ route: PublicRoute; spots: PublicSpot[] } | null> {
  const body = okBody<{ route: PublicRoute; spots: PublicSpot[] }>(await getJson(`/routes/${encodeURIComponent(id)}`));
  return body ? { route: body.route, spots: body.spots } : null;
}

export async function fetchPublicSpot(id: string): Promise<PublicSpot | null> {
  return okBody<{ spot: PublicSpot }>(await getJson(`/spots/${encodeURIComponent(id)}`))?.spot ?? null;
}

import { cache } from "react";
import type { PublicPlace, PublicRally, PublicRallyDetail, PublicRoute, PublicSpot } from "./api-content-types";
import type { RallyItem } from "./rally-model";
import type { TrailNotice } from "./notices";
import type { BlogPost } from "./posts";
import type { PlaceItem, Prefecture, RouteDetail, RoutePoint, RouteSummary, SpotDetail, SpotListItem } from "./content";
import { placeCategories, placeStatuses } from "./places";
import { isPointKind } from "./point-kinds";
import { areaFromBounds, sketchFromPoints } from "./route-geometry";
import type { Sketch } from "./sketch";
import { timesFromPrevious, type LegTime } from "./leg-times";

export { areaFromBounds, sketchFromPoints };

// Turns what the API sends (GET /routes, /routes/{id}, /spots/{id}) into the view-models the screens use, and
// fetches it on the server. Pure mappers first (unit-tested), then the fetchers. Server code only: it is on the
// client-boundary list, like the content module.

/** A sketch from the API's list answer: [lng, lat] (and the height when known), already short. */
function sketchFromList(sketch: [lng: number, lat: number, ele?: number][] | null): Sketch | null {
  return sketch && sketch.length >= 2 ? sketchFromPoints(sketch, 40) : null;
}

import { walkStyleOf } from "./walk-style";

const prefectureOf = (p: string | null): Prefecture | null => (p === "osaka" || p === "wakayama" || p === "nara" ? p : null);

export function routeSummaryFromApi(r: PublicRoute, order: number, stampedCount = 0): RouteSummary {
  return {
    id: r.id,
    order,
    status: r.status,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    prefecture: prefectureOf(r.prefecture),
    // A cached answer from before the field existed has none (the site keeps answers for PUBLIC_REVALIDATE_S).
    municipalities: r.municipalities ?? [],
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    difficulty: r.difficulty,
    nameKana: r.nameKana,
    accessPoints: r.accessPoints ?? [],
    physicalLevel: r.physicalLevel,
    technicalLevel: r.technicalLevel,
    expectedTimeMin: r.expectedTimeMin,
    farDistanceM: r.farDistanceM ?? null,
    sketch: sketchFromList(r.sketch),
    area: areaFromBounds(r.bounds),
    spotCount: r.publishedSpotCount,
    // How many of this course's places the visitor has stamped (0 when signed out; the viewer filter hides it then).
    stampedCount,
    photoUrl: r.photoUrl,
    photoCredit: r.photoCredit ?? null,
  };
}

export function spotListItemFromApi(s: PublicSpot, stamped = false): SpotListItem {
  return {
    id: s.id,
    nameJa: s.nameJa,
    nameEn: s.nameEn,
    status: s.status,
    ...(isPointKind(s.kind) ? { kind: s.kind } : {}),
    ...(s.stopBy ? { stopBy: true } : {}),
    stampable: s.stampable,
    stamped,
    position: s.position ? { lat: s.position.lat, lng: s.position.lng, verified: true } : null,
    descriptionJa: s.descriptionJa,
    descriptionEn: s.descriptionEn,
    statusNoteJa: s.statusNoteJa,
    statusNoteEn: s.statusNoteEn,
    statusUpdatedAt: s.statusUpdatedAt,
    photoUrl: s.photoUrl,
    photoCredit: s.photoCredit ?? null,
    stampImageUrl: s.stampImageUrl ?? null,
    sortOrder: s.sortOrder,
  };
}

/** A directory place as the screens use it; `order` is its course's number (1 to 19), or null when it is on none. A category or status this app does not know is read as "other" / "unknown". */
export function placeItemFromApi(p: PublicPlace, order: number | null): PlaceItem {
  return {
    id: p.id,
    category: placeCategories.find((c) => c === p.category) ?? "other",
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    nameKana: p.nameKana ?? null,
    icon: p.icon ?? null,
    nearSpotId: p.nearSpotId ?? null,
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
    photoUrl: p.photoUrl,
    photoCredit: p.photoCredit ?? null,
    addressJa: p.addressJa ?? null,
    addressEn: p.addressEn ?? null,
    phone: p.phone,
    website: p.website,
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
    photoUrl: s.photoUrl,
    photoCredit: s.photoCredit ?? null,
    sortOrder: s.sortOrder,
    ...(s.stopBy ? { stopBy: true } : {}),
    position: s.position ? { lat: s.position.lat, lng: s.position.lng, verified: true } : null,
  };
}

export function routeDetailFromApi(
  r: PublicRoute,
  spots: PublicSpot[],
  order: number,
  points: PublicSpot[] = [],
  /** The ids of the places the visitor has stamped. */
  mine: ReadonlySet<string> = new Set(),
): RouteDetail {
  const line = r.line?.coordinates ?? null;
  const times = line ? timesFromPrevious(spots.map((s) => ({ id: s.id, position: s.position, stopBy: s.stopBy })), line.map(([lng, lat, ele]) => (ele === undefined ? [lng, lat] : [lng, lat, ele])), r.rides ?? []) : new Map<string, LegTime>();
  return {
    ...routeSummaryFromApi(r, order, spots.filter((s) => mine.has(s.id)).length),
    // The detail has the whole line, so its silhouette and elevation come from that.
    sketch: line ? sketchFromPoints(line) : null,
    descriptionJa: r.descriptionJa,
    descriptionEn: r.descriptionEn,
    historyJa: r.historyJa,
    historyEn: r.historyEn,
    accessJa: r.accessJa,
    accessEn: r.accessEn,
    sourceJa: r.sourceJa ?? null,
    sourceEn: r.sourceEn ?? null,
    spots: spots.map((s) => {
      const item = spotListItemFromApi(s, mine.has(s.id));
      const fromPrev = times.get(s.id);
      return fromPrev ? { ...item, fromPrev } : item;
    }),
    points: points.flatMap((p) => routePointFromApi(p) ?? []),
    line: line ? line.map(([lng, lat]) => ({ lat, lng })) : null,
    lineElevations: line && line.some((p) => typeof p[2] === "number") ? line.map((p) => (typeof p[2] === "number" ? p[2] : null)) : null,
    sideLines: (r.sideLines ?? []).map((s) => ({ spotId: s.spotId, line: s.coordinates.map(([lng, lat]) => ({ lat, lng })) })),
    videoUrl: r.videoUrl,
    videoUpdatedAt: r.videoUpdatedAt ?? null,
    videoSubtitles: r.videoSubtitles === true,
    videoUrlEn: r.videoUrlEn ?? null,
    videoSubtitlesEn: r.videoSubtitlesEn === true,
    updatedAt: r.updatedAt ?? null,
    photoUrl: r.photoUrl,
    photoCredit: r.photoCredit ?? null,
    walkStyle: walkStyleOf(r.walkStyle),
  };
}

export function spotDetailFromApi(s: PublicSpot, route: Pick<PublicRoute, "id" | "nameJa" | "nameEn">, stamped = false): SpotDetail {
  return {
    ...spotListItemFromApi(s, stamped),
    nameKana: s.nameKana ?? null,
    routeId: route.id,
    routeNameJa: route.nameJa,
    routeNameEn: route.nameEn,
    descriptionJa: s.descriptionJa,
    descriptionEn: s.descriptionEn,
    historyJa: s.historyJa ?? null,
    historyEn: s.historyEn ?? null,
    statusNoteJa: s.statusNoteJa,
    statusNoteEn: s.statusNoteEn,
    statusUpdatedAt: s.statusUpdatedAt,
    updatedAt: s.updatedAt ?? null,
    photoUrl: s.photoUrl,
    photoCredit: s.photoCredit ?? null,
    sourceJa: s.sourceJa ?? null,
    sourceEn: s.sourceEn ?? null,
    gallery: s.photos ?? [],
  };
}

/** A course with nothing in it yet: no line, no published place, no text. Sample data may stand in for it. */
export function isEmptyRoute(r: Pick<PublicRoute, "bounds" | "publishedSpotCount" | "descriptionJa">): boolean {
  return r.bounds === null && r.publishedSpotCount === 0 && !r.descriptionJa;
}

// ---- fetching (server only) -----------------------------------------------------------------

const PUBLIC_REVALIDATE_S = 30;
const origin = () => process.env.API_ORIGIN ?? "http://localhost:3001";

async function getJson(path: string): Promise<{ status: number; body: unknown } | null> {
  try {
    // Public content is the same for everyone, so Next keeps the answer for a while: opening a tab or switching language
    // then costs no trip to the API. An edit in the admin reaches visitors within this time (plus the API's own 10 s).
    const res = await fetch(`${origin()}/api/v1${path}`, { next: { revalidate: PUBLIC_REVALIDATE_S }, signal: AbortSignal.timeout(3000) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null; // the API is not reachable: the caller shows an empty state, never a crash
  }
}

const okBody = <T>(r: { status: number; body: unknown } | null): T | null =>
  r && r.status === 200 && (r.body as { ok?: unknown } | null)?.ok === true ? (r.body as T) : null;

// The fetchers are wrapped in React's cache(): within one page render the same question is asked of the API once, however many
// parts of the page ask it (the map page asks for the course list once per course, and for every place it shows).
export const fetchPublicRoutes = cache(async (): Promise<PublicRoute[] | null> => {
  return okBody<{ routes: PublicRoute[] }>(await getJson("/routes"))?.routes ?? null;
});

export const fetchPublicRoute = cache(async (id: string): Promise<{ route: PublicRoute; spots: PublicSpot[]; points: PublicSpot[] } | null> => {
  const body = okBody<{ route: PublicRoute; spots: PublicSpot[]; points?: PublicSpot[] }>(await getJson(`/routes/${encodeURIComponent(id)}`));
  return body ? { route: body.route, spots: body.spots, points: body.points ?? [] } : null;
});

export const fetchPublicSpot = cache(async (id: string): Promise<PublicSpot | null> => {
  return okBody<{ spot: PublicSpot }>(await getJson(`/spots/${encodeURIComponent(id)}`))?.spot ?? null;
});

/** A course is finished when it has places and every one is stamped, a closed one counting as done and an information place not counting at all (the server's rule, rallies/progress.ts). */
const courseFinished = (spots: readonly { id: string; status: string }[], stamped: ReadonlySet<string>) =>
  spots.some((s) => s.status !== "info") && spots.every((s) => stamped.has(s.id) || s.status === "closed" || s.status === "info");

/**
 * The rallies the CMS publishes, as the stamp page shows them. A rally of places has one slot for each place; a rally of
 * courses one for each course, stamped once every published stamp place of that course is. `stamped` is the set of place
 * ids the visitor holds (empty when signed out: the page then hides the progress). `stampedAt` says when each was stamped,
 * so the page can put the rally the visitor last stamped in first.
 */
export function ralliesFromApi(rallies: readonly PublicRally[], stamped: ReadonlySet<string>, stampedAt: ReadonlyMap<string, string> = new Map()): RallyItem[] {
  return rallies.map((r, i): RallyItem => {
    const slots =
      r.kind === "places"
        ? r.places.map((p, n) => ({ id: p.id, number: n + 1, nameJa: p.nameJa, nameEn: p.nameEn, stamped: stamped.has(p.id) }))
        : r.courses.map((c, n) => ({ id: c.routeId, number: n + 1, nameJa: c.nameJa, nameEn: c.nameEn, stamped: courseFinished(c.spots, stamped) }));
    // The latest stamp among the rally's own places (for a rally of courses: the places of its courses).
    const placeIds = r.kind === "places" ? r.places.map((p) => p.id) : r.courses.flatMap((c) => c.spots.map((s) => s.id));
    const lastStampedAt = placeIds.reduce<string | null>((best, id) => {
      const at = stampedAt.get(id);
      return at && (!best || Date.parse(at) > Date.parse(best)) ? at : best;
    }, null);
    return { id: r.id, kind: "rally", order: i + 1, nameJa: r.nameJa, nameEn: r.nameEn, routeId: null, total: slots.length, stamped: slots.filter((s) => s.stamped).length, lastStampedAt, slots };
  });
}

/** The published stamp rallies, in order. */
export const fetchPublicRallies = cache(async (): Promise<PublicRally[] | null> => {
  return okBody<{ rallies: PublicRally[] }>(await getJson("/rallies"))?.rallies ?? null;
});

/** One published rally with the positions of its places, or null when it is a draft, not there, or the API cannot be reached. */
export const fetchPublicRally = cache(async (id: string): Promise<PublicRallyDetail | null> => {
  return okBody<{ rally: PublicRallyDetail }>(await getJson(`/rallies/${encodeURIComponent(id)}`))?.rally ?? null;
});

/** Published places of the directory (the API keeps back the ones without a checked position). */
export const fetchPublicPlaces = cache(async (): Promise<PublicPlace[] | null> => {
  return okBody<{ places: PublicPlace[] }>(await getJson("/places"))?.places ?? null;
});

/** Published trail notices that have not expired (the API decides, in Japan time). */
export async function fetchPublicNotices(): Promise<TrailNotice[] | null> {
  return okBody<{ notices: TrailNotice[] }>(await getJson("/notices"))?.notices ?? null;
}

/** Published blog posts whose day has come, newest first (the API decides, in Japan time). */
// The API answers a page of posts at a time and says where the next one starts (`next`). The blog builds its tag tabs, its pager and
// the "older / newer" links from the whole list, so every page is read; this many is far more than a trail blog will hold.
const MAX_POST_PAGES = 20;
export const fetchPublicPosts = cache(async (tag?: string): Promise<BlogPost[] | null> => {
  const posts: BlogPost[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_POST_PAGES; page++) {
    const query = new URLSearchParams(tag ? { tag } : {});
    if (offset > 0) query.set("offset", String(offset));
    const body = okBody<{ posts: BlogPost[]; next?: number | null }>(await getJson(query.size ? `/posts?${query}` : "/posts"));
    if (!body) return page === 0 ? null : posts; // a later page that cannot be read ends the list there
    posts.push(...body.posts);
    if (body.next == null) break; // an answer from before `next` existed is one whole list
    offset = body.next;
  }
  return posts;
});

/** One blog post, or null when it is a draft, dated ahead, or not there. */
export const fetchPublicPost = cache(async (id: string): Promise<BlogPost | null> => {
  return okBody<{ post: BlogPost }>(await getJson(`/posts/${encodeURIComponent(id)}`))?.post ?? null;
});

/** The approved comments of a post, oldest first. */
export const fetchPostComments = cache(async (id: string): Promise<{ id: string; body: string; authorName: string | null; createdAt: string }[]> => {
  return okBody<{ comments: { id: string; body: string; authorName: string | null; createdAt: string }[] }>(await getJson(`/posts/${encodeURIComponent(id)}/comments`))?.comments ?? [];
});

/** Published home page banners, in order. */
export async function fetchPublicBanners(): Promise<{ id: string; imageUrl: string; imageCredit?: string | null; altJa: string; altEn: string | null }[] | null> {
  return okBody<{ banners: { id: string; imageUrl: string; imageCredit?: string | null; altJa: string; altEn: string | null }[] }>(await getJson("/banners"))?.banners ?? null;
}

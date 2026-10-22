import type { ErrorCode } from "../lib/api-errors";
import { stampableByDefault } from "../db/schema/content";
import { cleanTranslations } from "../db/translations";
import { isHttpsUrl, isPhotoUrl } from "../lib/https-url";
import { isAllowedVideoUrl } from "./video-url";
import { lineLengthKm, parseLine, plainLine, ridesOf, sideLinesOf, simplifyLine, sketchOf, type LineString, type Ride } from "./line";
import type {
  ContentStore,
  Prefecture,
  Result,
  RouteFields,
  RouteRow,
  RouteSummaryRow,
  SpotFields,
  SpotRow,
  StoredRouteFields,
} from "./content-types";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (reason: ErrorCode): Result<never> => ({ ok: false, reason });

/** A place as visitors see it: the position is there only once a person has checked it. */
export interface PublicSpot {
  id: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  /** Its story: where the name comes from, what happened there. */
  historyJa: string | null;
  historyEn: string | null;
  position: { lat: number; lng: number; verified: true } | null;
  radiusM: number;
  kind: SpotRow["kind"];
  /** A stamp can be collected here (only then does the place have a page of its own). */
  stampable: boolean;
  /** An optional visit beside the way (寄り道). */
  stopBy: boolean;
  photoUrl: string | null;
  /** More photos of the place, in order, each with who took it when that is known. */
  photos: SpotRow["photos"];
  status: SpotRow["status"];
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  statusUpdatedAt: Date | null;
  sortOrder: number;
}

export interface PublicRoute {
  id: string;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: string | null;
  expectedTimeMin: number | null;
  prefecture: Prefecture | null;
  municipality: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  photoUrl: string | null;
  sortOrder: number;
  /** "soon" until at least one place is published. */
  status: "ready" | "soon";
  publishedSpotCount: number;
  sketch: [number, number][] | null;
  /** The drawn line (the detail only). */
  line: LineString | null;
  /** Side trips (寄り道) to published places, each a stretch out from the route (the detail only). */
  sideLines: { spotId: string; coordinates: LineString["coordinates"] }[];
  /** Stretches that are ridden (ferry, bus ...), with the minutes the editor gave: they replace the walking estimate to that place. */
  rides: { spotId: string; mode: Ride["mode"]; minutes: number }[];
  /** Corners of the box around the line, for the overview map. */
  bounds: { west: number; south: number; east: number; north: number } | null;
}

function boundsOf(line: LineString | null): PublicRoute["bounds"] {
  if (!line) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of line.coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

function toPublicRoute(r: RouteRow, publishedSpotCount: number, withLine: boolean, visibleSpotIds: ReadonlySet<string> = new Set()): PublicRoute {
  // A line nobody has checked is not shown: not the line, not its silhouette, not the box around it.
  const shown = r.lineVerified ? r.geometry : null;
  return {
    id: r.id,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    descriptionJa: r.descriptionJa,
    descriptionEn: r.descriptionEn,
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    difficulty: r.difficulty,
    expectedTimeMin: r.expectedTimeMin,
    prefecture: r.prefecture,
    municipality: r.municipality,
    videoUrl: r.videoUrl,
    historyJa: r.historyJa,
    historyEn: r.historyEn,
    accessJa: r.accessJa,
    accessEn: r.accessEn,
    photoUrl: r.photoUrl,
    sortOrder: r.sortOrder,
    status: publishedSpotCount > 0 ? "ready" : "soon",
    publishedSpotCount,
    sketch: shown ? sketchOf(shown) : null,
    line: withLine && shown ? plainLine(shown) : null,
    sideLines: withLine && shown ? sideLinesOf(shown, visibleSpotIds) : [],
    rides: withLine && shown ? ridesOf(shown, visibleSpotIds) : [],
    bounds: boundsOf(shown),
  };
}

function toPublicSpot(s: SpotRow): PublicSpot {
  const showPosition = s.positionVerified && s.lat !== null && s.lng !== null;
  return {
    id: s.id,
    routeId: s.routeId,
    nameJa: s.nameJa,
    nameEn: s.nameEn,
    descriptionJa: s.descriptionJa,
    descriptionEn: s.descriptionEn,
    historyJa: s.historyJa,
    historyEn: s.historyEn,
    position: showPosition ? { lat: s.lat!, lng: s.lng!, verified: true } : null,
    radiusM: s.radiusM,
    kind: s.kind,
    stampable: s.stampable,
    stopBy: s.stopBy,
    photoUrl: s.photoUrl,
    photos: s.photos,
    status: s.status,
    statusNoteJa: s.statusNoteJa,
    statusNoteEn: s.statusNoteEn,
    statusUpdatedAt: s.statusUpdatedAt,
    sortOrder: s.sortOrder,
  };
}


/** Blank text becomes null (an optional field left empty). */
const text = (v: string | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v === null ? null : v.trim() === "" ? null : v.trim();

/** `photoHosts` (PHOTO_HOSTS): when not empty, photos may only come from these host names. */
export function createContentService(deps: { store: ContentStore; photoHosts?: readonly string[]; publicRoutesTtlMs?: number }) {
  const { store } = deps;
  // shortcut: the public route list (which reads every route's line to draw its silhouette) is kept per process for
  // `publicRoutesTtlMs`, so a change shows up there after at most that long; precompute sketch/bounds columns if it must be instant.
  let routesCache: { at: number; value: Promise<PublicRoute[]> } | null = null;
  // The status poll reads every published place, so it shares the same short per-process cache.
  const listStatuses = () =>
    store.listPublishedSpots().then((rows) =>
      rows.map((s) => ({ id: s.id, status: s.status, statusNoteJa: s.statusNoteJa, statusNoteEn: s.statusNoteEn, statusUpdatedAt: s.statusUpdatedAt })),
    );
  let statusCache: { at: number; value: ReturnType<typeof listStatuses> } | null = null;
  const photoHosts = deps.photoHosts ?? [];

  /** Turn a request's route fields into what the store keeps, or say what is wrong. */
  function prepareRoute(input: Partial<RouteFields>): Result<Partial<StoredRouteFields>> {
    const out: Partial<StoredRouteFields> = {};
    if (input.nameJa !== undefined) {
      const n = input.nameJa.trim();
      if (!n) return bad("validation_failed");
      out.nameJa = n;
    }
    for (const k of ["nameEn", "descriptionJa", "descriptionEn", "difficulty", "municipality", "historyJa", "historyEn", "accessJa", "accessEn"] as const) {
      const v = text(input[k]);
      if (v !== undefined) out[k] = v;
    }
    if (input.translations !== undefined) out.translations = cleanTranslations(input.translations);
    if (input.distanceKm !== undefined) out.distanceKm = input.distanceKm;
    if (input.elevationGainM !== undefined) out.elevationGainM = input.elevationGainM;
    if (input.expectedTimeMin !== undefined) out.expectedTimeMin = input.expectedTimeMin;
    if (input.prefecture !== undefined) out.prefecture = input.prefecture;
    if (input.videoUrl !== undefined) {
      const v = text(input.videoUrl);
      if (v && !isAllowedVideoUrl(v)) return bad("invalid_video_url");
      out.videoUrl = v;
    }
    if (input.photoUrl !== undefined) {
      const v = text(input.photoUrl);
      if (v && !isPhotoUrl(v, photoHosts)) return bad("invalid_photo_url");
      out.photoUrl = v;
    }
    if (input.lineVerified !== undefined) out.lineVerified = input.lineVerified;
    {
      const v = text(input.lineSource);
      if (v !== undefined) out.lineSource = v;
    }
    if (input.geometry !== undefined) {
      if (input.geometry === null) out.geometry = null;
      else {
        const parsed = parseLine(input.geometry);
        if (!parsed.ok) return bad("invalid_line");
        // The legs are the editor's own copy and keep their detail; the line everyone else reads is cut down.
        out.geometry = { ...simplifyLine(parsed.line, 2000), ...(parsed.line.legs ? { legs: parsed.line.legs } : {}) };
        // The distance follows the line unless the admin typed one in the same save. Measured before the line is
        // simplified: cutting corners would make a winding route read shorter than it is.
        if (input.distanceKm === undefined) out.distanceKm = lineLengthKm(parsed.line);
      }
    }
    return ok(out);
  }

  function prepareSpot(input: Partial<SpotFields>): Result<Partial<SpotFields>> {
    const out: Partial<SpotFields> = {};
    if (input.nameJa !== undefined) {
      const n = input.nameJa.trim();
      if (!n) return bad("validation_failed");
      out.nameJa = n;
    }
    for (const k of ["nameEn", "descriptionJa", "descriptionEn", "historyJa", "historyEn", "statusNoteJa", "statusNoteEn", "permissionNote", "positionSource"] as const) {
      const v = text(input[k]);
      if (v !== undefined) out[k] = v;
    }
    if (input.translations !== undefined) out.translations = cleanTranslations(input.translations);
    if (input.lat !== undefined) out.lat = input.lat;
    if (input.lng !== undefined) out.lng = input.lng;
    if (input.radiusM !== undefined) out.radiusM = input.radiusM;
    if (input.status !== undefined) out.status = input.status;
    if (input.kind !== undefined) out.kind = input.kind;
    if (input.stampable !== undefined) out.stampable = input.stampable;
    if (input.stopBy !== undefined) out.stopBy = input.stopBy;
    if (input.photoUrl !== undefined) {
      const v = text(input.photoUrl);
      if (v && !isPhotoUrl(v, photoHosts)) return bad("invalid_photo_url");
      out.photoUrl = v;
    }
    if (input.photos !== undefined) {
      // Wikimedia Commons is always allowed for the gallery (the photo finder in the editor uses it), as well as the photo hosts.
      const hosts = photoHosts.length > 0 ? [...photoHosts, "upload.wikimedia.org"] : [];
      const photos: NonNullable<SpotFields["photos"]> = [];
      for (const p of input.photos) {
        const url = p.url.trim();
        const sourceUrl = text(p.sourceUrl) ?? null;
        if (!isPhotoUrl(url, hosts) || (sourceUrl !== null && !isHttpsUrl(sourceUrl))) return bad("invalid_photo_url");
        photos.push({ url, credit: text(p.credit) ?? null, sourceUrl });
      }
      out.photos = photos;
    }
    if (input.permissionConfirmed !== undefined) out.permissionConfirmed = input.permissionConfirmed;
    if (input.positionVerified !== undefined) out.positionVerified = input.positionVerified;
    // A position is both numbers or neither.
    if ((out.lat === undefined) !== (out.lng === undefined)) return bad("validation_failed");
    if ((out.lat === null) !== (out.lng === null)) return bad("validation_failed");
    return ok(out);
  }

  const date = (d: Date | string) => (d instanceof Date ? d : new Date(d));

  return {
    // ---- admin: routes -------------------------------------------------------------------
    listRoutes: (): Promise<RouteSummaryRow[]> => store.listRoutes(),
    getRoute: (id: string) => store.getRoute(id),

    async createRoute(actor: string, input: Partial<RouteFields> & { nameJa: string }): Promise<Result<RouteRow>> {
      const p = prepareRoute(input);
      if (!p.ok) return p;
      return ok(await store.createRoute(actor, { ...p.value, nameJa: p.value.nameJa! }));
    },

    async updateRoute(actor: string, id: string, expected: Date | string, input: Partial<RouteFields>): Promise<Result<RouteRow>> {
      const p = prepareRoute(input);
      if (!p.ok) return p;
      const current = await store.getRoute(id);
      if (!current) return bad("not_found");
      const changes = p.value;
      // Redrawing the line cancels the check on it, unless the same save checks it again.
      if (changes.geometry !== undefined && changes.lineVerified === undefined) changes.lineVerified = false;
      if ((changes.lineVerified ?? current.route.lineVerified) === true) {
        if (!(changes.lineSource !== undefined ? changes.lineSource : current.route.lineSource)) return bad("source_required");
        if ((changes.geometry !== undefined ? changes.geometry : current.route.geometry) === null) return bad("invalid_line");
      }
      const r = await store.updateRoute(actor, id, date(expected), changes);
      if (r === null) return bad("not_found");
      if (r === "conflict") return bad("conflict");
      return ok(r);
    },

    async reorderRoutes(actor: string, ids: string[]): Promise<Result<true>> {
      return (await store.reorderRoutes(actor, ids)) ? ok(true) : bad("validation_failed");
    },

    async deleteRoute(actor: string, id: string): Promise<Result<true>> {
      const r = await store.deleteRoute(actor, id);
      return r === "ok" ? ok(true) : bad(r === "has_places" ? "route_has_places" : "not_found");
    },

    // ---- admin: places -------------------------------------------------------------------
    async createSpot(actor: string, routeId: string, input: Partial<SpotFields> & { nameJa: string }): Promise<Result<SpotRow>> {
      const p = prepareSpot(input);
      if (!p.ok) return p;
      if (p.value.positionVerified) {
        if (!p.value.positionSource) return bad("source_required");
        if (p.value.lat === undefined || p.value.lat === null) return bad("no_coordinates");
      }
      // The stamp switch starts from the kind unless the request sets it.
      const stampable = p.value.stampable ?? stampableByDefault(p.value.kind ?? "other");
      const s = await store.createSpot(actor, routeId, { ...p.value, stampable, nameJa: p.value.nameJa! });
      return s ? ok(s) : bad("not_found");
    },

    async updateSpot(actor: string, id: string, expected: Date | string, input: Partial<SpotFields>): Promise<Result<SpotRow>> {
      const p = prepareSpot(input);
      if (!p.ok) return p;
      const current = await store.getSpot(id);
      if (!current) return bad("not_found");
      const moved = p.value.lat !== undefined && (p.value.lat !== current.lat || p.value.lng !== current.lng);
      const changes: Partial<SpotFields> = { ...p.value };
      // Moving a place cancels the check on its position, unless the same save checks it again.
      if (moved && p.value.positionVerified === undefined) changes.positionVerified = false;
      const verifiedNow = changes.positionVerified ?? current.positionVerified;
      if (changes.positionVerified === true) {
        if (!(changes.positionSource ?? current.positionSource)) return bad("source_required");
        if ((changes.lat !== undefined ? changes.lat : current.lat) === null) return bad("no_coordinates");
      }
      if (current.published) {
        // A published place must keep passing every publish rule.
        if (!verifiedNow) return bad("position_not_verified");
        // Only a waypoint with a stamp needs the site's permission (a toilet or a turn on the path does not).
        if ((changes.stampable ?? current.stampable) && !(changes.permissionConfirmed ?? current.permissionConfirmed)) return bad("permission_required");
        if (changes.lat === null) return bad("no_coordinates");
      }
      const r = await store.updateSpot(actor, id, date(expected), changes);
      if (r === null) return bad("not_found");
      if (r === "conflict") return bad("conflict");
      if (r === "has_stamps") return bad("spot_has_stamps");
      return ok(r);
    },

    async publishSpot(actor: string, id: string): Promise<Result<SpotRow>> {
      const s = await store.getSpot(id);
      if (!s) return bad("not_found");
      if (s.lat === null || s.lng === null) return bad("no_coordinates");
      if (!s.positionVerified) return bad("position_not_verified");
      if (s.stampable && !s.permissionConfirmed) return bad("permission_required");
      const r = await store.setPublished(actor, id, true);
      if (!r) return bad("not_found");
      // The store re-checks the same rules inside the write; a place changed in between stays unpublished.
      return r.published ? ok(r) : bad("position_not_verified");
    },

    async unpublishSpot(actor: string, id: string): Promise<Result<SpotRow>> {
      const r = await store.setPublished(actor, id, false);
      return r ? ok(r) : bad("not_found");
    },

    async deleteSpot(actor: string, id: string): Promise<Result<true>> {
      const r = await store.deleteSpot(actor, id);
      return r === "ok" ? ok(true) : bad(r === "has_stamps" ? "spot_has_stamps" : "not_found");
    },

    async reorderSpots(actor: string, routeId: string, ids: string[]): Promise<Result<true>> {
      return (await store.reorderSpots(actor, routeId, ids)) ? ok(true) : bad("validation_failed");
    },

    // ---- public --------------------------------------------------------------------------
    /** All routes, ready or coming soon, in walking order. */
    publicRoutes(): Promise<PublicRoute[]> {
      const ttl = deps.publicRoutesTtlMs ?? 0;
      if (ttl > 0 && routesCache && Date.now() - routesCache.at < ttl) return routesCache.value;
      const value = store.listRoutes().then((rows) => rows.map((r) => toPublicRoute(r, r.publishedSpotCount, false)));
      if (ttl > 0) {
        routesCache = { at: Date.now(), value };
        value.catch(() => (routesCache = null)); // never keep a failure
      }
      return value;
    },

    /** The route, its published stamp places, and its published navigation points (turns, toilets, danger ...). */
    async publicRoute(id: string): Promise<{ route: PublicRoute; spots: PublicSpot[]; points: PublicSpot[] } | null> {
      const found = await store.getRoute(id);
      if (!found) return null;
      const published = found.spots.filter((s) => s.published).sort((a, b) => a.sortOrder - b.sortOrder);
      const stamps = published.filter((s) => s.stampable);
      const points = published.filter((s) => !s.stampable);
      // A side trip is shown only once the place it leads to is published, like the place itself.
      return { route: toPublicRoute(found.route, stamps.length, true, new Set(published.map((s) => s.id))), spots: stamps.map(toPublicSpot), points: points.map(toPublicSpot) };
    },

    /** Status of every published place, nothing else: small enough to poll every minute. */
    async publicSpotStatuses() {
      const ttl = deps.publicRoutesTtlMs ?? 0;
      if (ttl > 0 && statusCache && Date.now() - statusCache.at < ttl) return statusCache.value;
      const value = listStatuses();
      if (ttl > 0) {
        statusCache = { at: Date.now(), value };
        value.catch(() => (statusCache = null)); // never keep a failure
      }
      return value;
    },

    /** A draft place looks like a missing one. */
    async publicSpot(id: string): Promise<PublicSpot | null> {
      const s = await store.getSpot(id);
      return s && s.published ? toPublicSpot(s) : null;
    },
  };
}

export type ContentService = ReturnType<typeof createContentService>;

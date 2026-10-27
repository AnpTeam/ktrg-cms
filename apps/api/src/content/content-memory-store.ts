import { mergeTranslations } from "../db/translations";
import type { AuditWriter } from "../audit/audit-log";
import type { ContentStore, RouteRow, RouteSummaryRow, SpotFields, SpotRow, StoredRouteFields } from "./content-types";

/**
 * In-memory store for tests and the dev test page. It behaves like the Drizzle one:
 * a stale `expected` time is a conflict, a route with places or a place with stamps cannot be deleted,
 * a new place joins no rally by itself, and a point that stops being a stamp place leaves every rally of places.
 */
export function createMemoryContentStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const routes = new Map<string, RouteRow>();
  const videoOld = new Map<string, string[]>(); // route id -> video links it had, newest first
  const spots = new Map<string, SpotRow>();
  /** place id -> the rallies of places that list it (rally_spots). */
  const placeRallies = new Map<string, Set<string>>();
  const stamped = new Set<string>();
  let n = 0;
  // Unique, valid UUIDs (the audit log insists on them).
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  // A tick so two saves in the same millisecond still get different update times, like the database's microseconds.
  let tick = 0;
  const stampTime = () => new Date(now().getTime() + ++tick);

  const sortedSpots = (routeId: string) => [...spots.values()].filter((s) => s.routeId === routeId).sort((a, b) => a.sortOrder - b.sortOrder);

  const store: ContentStore = {
    async listRoutes() {
      return [...routes.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map<RouteSummaryRow>((r) => {
          const ss = sortedSpots(r.id);
          const stamps = ss.filter((s) => s.stampable);
          const { legs: _legs, ...line } = r.geometry ?? { type: "LineString" as const, coordinates: [] as [number, number][], legs: undefined };
          return { ...r, geometry: r.geometry ? line : null, spotCount: stamps.length, publishedSpotCount: stamps.filter((s) => s.published).length, pointCount: ss.length - stamps.length };
        });
    },
    async getRoute(id) {
      const route = routes.get(id);
      return route ? { route, spots: sortedSpots(id) } : null;
    },
    async getSpot(id) {
      return spots.get(id) ?? null;
    },
    async listPublishedSpots() {
      return [...spots.values()].filter((s) => s.published);
    },

    async createRoute(actor, fields) {
      const at = stampTime();
      const row: RouteRow = {
        id: uuid(), nameEn: null, descriptionJa: null, descriptionEn: null, distanceKm: null,
        elevationGainM: null, difficulty: null, nameKana: null, accessPoints: [], physicalLevel: null, technicalLevel: null, expectedTimeMin: null, prefecture: null, walkStyle: null, municipality: null, geometry: null, lineVerified: false, lineSource: null,
        videoUrl: null, videoUpdatedAt: null, videoSubtitles: false, historyJa: null, historyEn: null, accessJa: null, accessEn: null, sourceJa: null, sourceEn: null, photoUrl: null, photoCredit: null, sortOrder: routes.size + 1, createdAt: at, updatedAt: at, ...fields,
        translations: mergeTranslations({}, fields.translations),
      };
      routes.set(row.id, row);
      await audit.record({ actorUserId: actor, action: "route.create", targetId: row.id });
      return row;
    },
    async updateRoute(actor, id, expected, changes: Partial<StoredRouteFields>) {
      const cur = routes.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      if (changes.videoUrl !== undefined && cur.videoUrl && changes.videoUrl !== cur.videoUrl) videoOld.set(id, [cur.videoUrl, ...(videoOld.get(id) ?? [])]);
      const next: RouteRow = { ...cur, ...changes, translations: mergeTranslations(cur.translations, changes.translations), updatedAt: stampTime() };
      routes.set(id, next);
      await audit.record({ actorUserId: actor, action: "route.update", targetId: id });
      return next;
    },
    async reorderRoutes(actor, ids) {
      if (ids.length !== routes.size || new Set(ids).size !== ids.length || !ids.every((i) => routes.has(i))) return false;
      ids.forEach((id, i) => routes.set(id, { ...routes.get(id)!, sortOrder: i + 1 }));
      await audit.record({ actorUserId: actor, action: "route.reorder", targetId: null });
      return true;
    },
    async deleteRoute(actor, id) {
      if (!routes.has(id)) return "not_found";
      if (sortedSpots(id).length > 0) return "has_places";
      routes.delete(id);
      await audit.record({ actorUserId: actor, action: "route.delete", targetId: id });
      return "ok";
    },

    async createSpot(actor, routeId, fields) {
      if (!routes.has(routeId)) return null;
      const at = stampTime();
      const row: SpotRow = {
        id: uuid(), routeId, nameEn: null, descriptionJa: null, descriptionEn: null, historyJa: null, historyEn: null, lat: null, lng: null,
        positionVerified: false, positionSource: null, radiusM: 50, kind: "other", stampable: false, stopBy: false, stampImageUrl: null, photoUrl: null, photoCredit: null, photos: [], status: "open", statusNoteJa: null, statusNoteEn: null, sourceJa: null, sourceEn: null,
        statusUpdatedAt: null, sortOrder: sortedSpots(routeId).length + 1, published: false, permissionConfirmed: false,
        permissionNote: null, createdAt: at, updatedAt: at, ...fields,
        translations: mergeTranslations({}, fields.translations),
      };
      spots.set(row.id, row);
      await audit.record({ actorUserId: actor, action: "spot.create", targetId: row.id });
      return row;
    },
    async updateSpot(actor, id, expected, changes: Partial<SpotFields>) {
      const cur = spots.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const switchedOff = changes.stampable === false && cur.stampable;
      if (switchedOff && stamped.has(id)) return "has_stamps";
      if (switchedOff) placeRallies.delete(id);
      const statusChanged = changes.status !== undefined && changes.status !== cur.status;
      const next: SpotRow = { ...cur, ...changes, translations: mergeTranslations(cur.translations, changes.translations), updatedAt: stampTime(), statusUpdatedAt: statusChanged ? now() : cur.statusUpdatedAt };
      spots.set(id, next);
      await audit.record({ actorUserId: actor, action: "spot.update", targetId: id });
      if (statusChanged) await audit.record({ actorUserId: actor, action: "spot.status.change", targetId: id });
      return next;
    },
    async setPublished(actor, id, published) {
      const cur = spots.get(id);
      if (!cur) return null;
      if (cur.published === published) return cur;
      const next: SpotRow = { ...cur, published, updatedAt: stampTime() };
      spots.set(id, next);
      await audit.record({ actorUserId: actor, action: published ? "spot.publish" : "spot.unpublish", targetId: id });
      return next;
    },
    // The in-memory audit writer keeps its rows to itself, so the history is empty here (the real store is tested on PostgreSQL).
    async videoHistory(routeId, limit) {
      return [...new Set(videoOld.get(routeId) ?? [])].slice(0, limit);
    },
    async routeHistory() {
      return [];
    },
    async unpublishRouteSpots(actor, routeId) {
      if (!routes.has(routeId)) return null;
      const changed: SpotRow[] = [];
      for (const cur of [...spots.values()]) {
        if (cur.routeId !== routeId || !cur.published) continue;
        const next: SpotRow = { ...cur, published: false, updatedAt: stampTime() };
        spots.set(cur.id, next);
        await audit.record({ actorUserId: actor, action: "spot.unpublish", targetId: cur.id });
        changed.push(next);
      }
      return changed;
    },
    async deleteSpot(actor, id) {
      const cur = spots.get(id);
      if (!cur) return "not_found";
      if (stamped.has(id)) return "has_stamps";
      spots.delete(id);
      placeRallies.delete(id);
      await audit.record({ actorUserId: actor, action: "spot.delete", targetId: id });
      return "ok";
    },
    async reorderSpots(actor, routeId, ids) {
      const cur = sortedSpots(routeId);
      if (ids.length !== cur.length || new Set(ids).size !== ids.length || !ids.every((i) => spots.get(i)?.routeId === routeId)) return false;
      ids.forEach((id, i) => spots.set(id, { ...spots.get(id)!, sortOrder: i + 1 }));
      await audit.record({ actorUserId: actor, action: "spot.reorder", targetId: routeId });
      return true;
    },
  };

  return {
    store,
    /** Test helpers: list a place in a rally of places, the rallies that list it, and a visitor's stamp on a place. */
    listInRally: (spotId: string, rallyId: string) => void placeRallies.set(spotId, new Set([...(placeRallies.get(spotId) ?? []), rallyId])),
    ralliesListing: (spotId: string) => [...(placeRallies.get(spotId) ?? [])],
    stampPlace: (spotId: string) => void stamped.add(spotId),
  };
}

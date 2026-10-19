import type { AuditWriter } from "../audit/audit-log";
import type { ContentStore, RouteRow, RouteSummaryRow, SpotFields, SpotRow, StoredRouteFields } from "./content-types";

/**
 * In-memory store for tests and the dev test page. It behaves like the Drizzle one:
 * a stale `expected` time is a conflict, a route with places or a place with stamps cannot be deleted,
 * and a new place joins its route's course rally.
 */
export function createMemoryContentStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const routes = new Map<string, RouteRow>();
  const spots = new Map<string, SpotRow>();
  /** route id -> ids of the places in that route's course rally, in order. */
  const courseRally = new Map<string, string[]>();
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
          return { ...r, spotCount: ss.length, publishedSpotCount: ss.filter((s) => s.published).length };
        });
    },
    async getRoute(id) {
      const route = routes.get(id);
      return route ? { route, spots: sortedSpots(id) } : null;
    },
    async getSpot(id) {
      return spots.get(id) ?? null;
    },

    async createRoute(actor, fields) {
      const at = stampTime();
      const row: RouteRow = {
        id: uuid(), nameEn: null, descriptionJa: null, descriptionEn: null, distanceKm: null,
        elevationGainM: null, difficulty: null, expectedTimeMin: null, prefecture: null, municipality: null, geometry: null,
        videoUrl: null, sortOrder: routes.size + 1, createdAt: at, updatedAt: at, ...fields,
      };
      routes.set(row.id, row);
      await audit.record({ actorUserId: actor, action: "route.create", targetId: row.id });
      return row;
    },
    async updateRoute(actor, id, expected, changes: Partial<StoredRouteFields>) {
      const cur = routes.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const next: RouteRow = { ...cur, ...changes, updatedAt: stampTime() };
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
      courseRally.delete(id);
      await audit.record({ actorUserId: actor, action: "route.delete", targetId: id });
      return "ok";
    },

    async createSpot(actor, routeId, fields) {
      if (!routes.has(routeId)) return null;
      const at = stampTime();
      const row: SpotRow = {
        id: uuid(), routeId, nameEn: null, descriptionJa: null, descriptionEn: null, lat: null, lng: null,
        positionVerified: false, positionSource: null, radiusM: 50, status: "open", statusNoteJa: null, statusNoteEn: null,
        statusUpdatedAt: null, sortOrder: sortedSpots(routeId).length + 1, published: false, permissionConfirmed: false,
        permissionNote: null, createdAt: at, updatedAt: at, ...fields,
      };
      spots.set(row.id, row);
      courseRally.set(routeId, [...(courseRally.get(routeId) ?? []), row.id]);
      await audit.record({ actorUserId: actor, action: "spot.create", targetId: row.id });
      return row;
    },
    async updateSpot(actor, id, expected, changes: Partial<SpotFields>) {
      const cur = spots.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const statusChanged = changes.status !== undefined && changes.status !== cur.status;
      const next: SpotRow = { ...cur, ...changes, updatedAt: stampTime(), statusUpdatedAt: statusChanged ? now() : cur.statusUpdatedAt };
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
    async deleteSpot(actor, id) {
      const cur = spots.get(id);
      if (!cur) return "not_found";
      if (stamped.has(id)) return "has_stamps";
      spots.delete(id);
      courseRally.set(cur.routeId, (courseRally.get(cur.routeId) ?? []).filter((x) => x !== id));
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
    /** Test helpers: what the course rally of a route holds, and a visitor's stamp on a place. */
    courseRallySpotIds: (routeId: string) => [...(courseRally.get(routeId) ?? [])],
    stampPlace: (spotId: string) => void stamped.add(spotId),
  };
}

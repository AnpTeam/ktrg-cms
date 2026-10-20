import type { AuditWriter } from "../audit/audit-log";
import type { RallyAdminStore, RallyCourse, RallyPlace, RallyRow } from "./rally-admin-types";

/** A place the memory store knows: a waypoint with a stamp (stampable) or without. */
export interface MemoryPlace extends RallyPlace {
  stampable: boolean;
  sortOrder: number;
}

/**
 * In-memory store for tests and the dev page. It behaves like the Drizzle one: a stale `expected` time is a
 * conflict, members are replaced in the order given, a new rally is a draft at the end, deleting a rally takes its
 * links and finishes with it.
 */
export function createMemoryRallyAdminStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const rallies = new Map<string, Omit<RallyRow, "memberCount" | "completionCount">>();
  const members = new Map<string, string[]>();
  const finishes = new Map<string, number>();
  const routes = new Map<string, { nameJa: string; nameEn: string | null; sortOrder: number }>();
  const places = new Map<string, MemoryPlace>();
  let n = 0;
  const uuid = () => `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`;
  let tick = 0;
  const stampTime = () => new Date(now().getTime() + ++tick);

  const row = (id: string): RallyRow => ({ ...rallies.get(id)!, memberCount: (members.get(id) ?? []).length, completionCount: finishes.get(id) ?? 0 });
  const routeOrder = (id: string) => routes.get(id)?.sortOrder ?? 0;
  const asPlace = ({ stampable: _k, sortOrder: _s, ...p }: MemoryPlace): RallyPlace => p;
  const asCourse = (routeId: string): RallyCourse => {
    const stamps = [...places.values()].filter((p) => p.routeId === routeId && p.stampable);
    const r = routes.get(routeId)!;
    return { routeId, nameJa: r.nameJa, nameEn: r.nameEn, stampPlaceCount: stamps.length, publishedStampPlaceCount: stamps.filter((p) => p.published).length };
  };
  const stampPlaces = () =>
    [...places.values()].filter((p) => p.stampable).sort((a, b) => routeOrder(a.routeId) - routeOrder(b.routeId) || a.sortOrder - b.sortOrder);

  function claim(id: string, expected: Date): "conflict" | null | true {
    const cur = rallies.get(id);
    if (!cur) return null;
    if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
    rallies.set(id, { ...cur, updatedAt: stampTime() });
    return true;
  }

  const store: RallyAdminStore = {
    async listRallies() {
      return [...rallies.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => row(r.id));
    },
    async getRally(id) {
      const r = rallies.get(id);
      if (!r) return null;
      const ids = members.get(id) ?? [];
      return r.kind === "places"
        ? { rally: { ...row(id), kind: "places" }, places: ids.map((s, i) => ({ ...asPlace(places.get(s)!), position: i + 1 })) }
        : { rally: { ...row(id), kind: "course" }, courses: ids.map((c, i) => ({ ...asCourse(c), position: i + 1 })) };
    },
    async candidatePlaces() {
      return stampPlaces().map(asPlace);
    },
    async candidateCourses() {
      return [...routes.keys()].sort((a, b) => routeOrder(a) - routeOrder(b)).map(asCourse);
    },
    async createRally(actor, fields) {
      const at = stampTime();
      const id = uuid();
      const last = Math.max(0, ...[...rallies.values()].map((r) => r.sortOrder));
      rallies.set(id, { id, kind: fields.kind, nameJa: fields.nameJa, nameEn: fields.nameEn, sortOrder: last + 1, published: false, createdAt: at, updatedAt: at });
      members.set(id, [...fields.memberIds]);
      await audit.record({ actorUserId: actor, action: "rally.create", targetId: id });
      return row(id);
    },
    async updateRally(actor, id, expected, changes) {
      const wasPublished = rallies.get(id)?.published;
      const c = claim(id, expected);
      if (c !== true) return c;
      rallies.set(id, { ...rallies.get(id)!, ...changes });
      await audit.record({ actorUserId: actor, action: "rally.update", targetId: id });
      if (changes.published !== undefined && changes.published !== wasPublished) {
        await audit.record({ actorUserId: actor, action: changes.published ? "rally.publish" : "rally.unpublish", targetId: id });
      }
      return row(id);
    },
    async reorderRallies(actor, ids) {
      if (ids.length !== rallies.size || new Set(ids).size !== ids.length || !ids.every((i) => rallies.has(i))) return false;
      ids.forEach((id, i) => rallies.set(id, { ...rallies.get(id)!, sortOrder: i + 1 }));
      await audit.record({ actorUserId: actor, action: "rally.reorder", targetId: null });
      return true;
    },
    async setPlaces(actor, id, expected, spotIds) {
      const c = claim(id, expected);
      if (c !== true) return c;
      members.set(id, [...spotIds]);
      await audit.record({ actorUserId: actor, action: "rally.members.update", targetId: id });
      return row(id);
    },
    async setCourses(actor, id, expected, routeIds) {
      const c = claim(id, expected);
      if (c !== true) return c;
      members.set(id, [...routeIds]);
      await audit.record({ actorUserId: actor, action: "rally.members.update", targetId: id });
      return row(id);
    },
    async deleteRally(actor, id) {
      if (!rallies.delete(id)) return "not_found";
      members.delete(id);
      finishes.delete(id);
      await audit.record({ actorUserId: actor, action: "rally.delete", targetId: id });
      return "ok";
    },
  };

  return {
    store,
    /** Test and dev-page helpers: put routes, places and rallies in place without going through the API. */
    addRoute(id: string, route: { nameJa: string; nameEn?: string | null; sortOrder: number }) {
      routes.set(id, { nameJa: route.nameJa, nameEn: route.nameEn ?? null, sortOrder: route.sortOrder });
    },
    addPlace(place: Omit<MemoryPlace, "nameEn" | "published"> & { nameEn?: string | null; published?: boolean }) {
      places.set(place.spotId, { nameEn: null, published: false, ...place });
    },
    addRally(rally: Partial<RallyRow> & Pick<RallyRow, "kind" | "nameJa">, memberIds: string[] = []): RallyRow {
      const at = stampTime();
      const id = uuid();
      const { memberCount: _m, completionCount: _c, ...rest } = { id, nameEn: null, sortOrder: rallies.size, published: false, createdAt: at, updatedAt: at, memberCount: 0, completionCount: 0, ...rally };
      rallies.set(id, { ...rest, id });
      members.set(id, [...memberIds]);
      return row(id);
    },
    /** Pretend this many visitors have finished the rally. */
    setFinished: (id: string, count: number) => void finishes.set(id, count),
    membersOf: (id: string) => [...(members.get(id) ?? [])],
  };
}

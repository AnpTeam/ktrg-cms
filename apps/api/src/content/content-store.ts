import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { rallies, rallySpots, routes, spots, stamps } from "../db/schema";
import type { ContentStore, RouteRow, RouteSummaryRow, SpotRow } from "./content-types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const routeFromDb = (r: typeof routes.$inferSelect): RouteRow => ({
  ...r,
  prefecture: r.prefecture as RouteRow["prefecture"],
  geometry: (r.geometry ?? null) as RouteRow["geometry"],
});
const spotFromDb = (s: typeof spots.$inferSelect): SpotRow => ({ ...s });

/**
 * The editor sends back the updatedAt it loaded. A JavaScript Date keeps milliseconds, the database keeps
 * microseconds, so compare at millisecond precision or every save would look like a conflict.
 */
const sameInstant = (column: typeof routes.updatedAt | typeof spots.updatedAt, expected: Date) =>
  sql`date_trunc('milliseconds', ${column}) = ${expected.toISOString()}::timestamptz`;

export function createDrizzleContentStore(db: Db): ContentStore {
  async function nextRouteOrder(tx: Tx): Promise<number> {
    const [row] = await tx.select({ m: max(routes.sortOrder) }).from(routes);
    return (row?.m ?? 0) + 1;
  }
  async function nextSpotOrder(tx: Tx, routeId: string): Promise<number> {
    const [row] = await tx.select({ m: max(spots.sortOrder) }).from(spots).where(eq(spots.routeId, routeId));
    return (row?.m ?? 0) + 1;
  }
  const courseRallyOf = async (tx: Tx, routeId: string) =>
    (await tx.select({ id: rallies.id }).from(rallies).where(and(eq(rallies.kind, "course"), eq(rallies.routeId, routeId))).limit(1))[0]?.id ?? null;

  return {
    async listRoutes() {
      const rows = await db.select().from(routes).orderBy(asc(routes.sortOrder));
      const counts = await db
        .select({
          routeId: spots.routeId,
          // Stamp places and the route's other points are counted apart.
          total: sql<number>`count(*) filter (where ${spots.kind} = 'stamp')`.mapWith(Number),
          published: sql<number>`count(*) filter (where ${spots.published} and ${spots.kind} = 'stamp')`.mapWith(Number),
          points: sql<number>`count(*) filter (where ${spots.kind} <> 'stamp')`.mapWith(Number),
        })
        .from(spots)
        .groupBy(spots.routeId);
      const byRoute = new Map(counts.map((c) => [c.routeId, c]));
      return rows.map<RouteSummaryRow>((r) => ({
        ...routeFromDb(r),
        spotCount: byRoute.get(r.id)?.total ?? 0,
        publishedSpotCount: byRoute.get(r.id)?.published ?? 0,
        pointCount: byRoute.get(r.id)?.points ?? 0,
      }));
    },

    async getRoute(id) {
      const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
      if (!route) return null;
      const list = await db.select().from(spots).where(eq(spots.routeId, id)).orderBy(asc(spots.sortOrder));
      return { route: routeFromDb(route), spots: list.map(spotFromDb) };
    },

    async getSpot(id) {
      const [s] = await db.select().from(spots).where(eq(spots.id, id)).limit(1);
      return s ? spotFromDb(s) : null;
    },

    async createRoute(actor, fields) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(routes)
          .values({ ...fields, sortOrder: await nextRouteOrder(tx) })
          .returning();
        await writeAudit(tx, { actorUserId: actor, action: "route.create", targetId: row!.id });
        return routeFromDb(row!);
      });
    },

    async updateRoute(actor, id, expected, changes) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(routes)
          .set({ ...changes, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(routes.id, id), sameInstant(routes.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: "route.update", targetId: id });
        return routeFromDb(row);
      });
    },

    async reorderRoutes(actor, ids) {
      return db.transaction(async (tx) => {
        const all = await tx.select({ id: routes.id }).from(routes);
        if (ids.length !== all.length || new Set(ids).size !== ids.length || !all.every((r) => ids.includes(r.id))) return false;
        for (const [i, id] of ids.entries()) await tx.update(routes).set({ sortOrder: i + 1 }).where(eq(routes.id, id));
        await writeAudit(tx, { actorUserId: actor, action: "route.reorder", targetId: null });
        return true;
      });
    },

    async deleteRoute(actor, id) {
      return db.transaction(async (tx) => {
        const [exists] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, id)).limit(1);
        if (!exists) return "not_found";
        const [n] = await tx.select({ n: count() }).from(spots).where(eq(spots.routeId, id));
        if ((n?.n ?? 0) > 0) return "has_places";
        // The route's own course rally goes with it (its links go by cascade).
        await tx.delete(rallies).where(and(eq(rallies.kind, "course"), eq(rallies.routeId, id)));
        await tx.delete(routes).where(eq(routes.id, id));
        await writeAudit(tx, { actorUserId: actor, action: "route.delete", targetId: id });
        return "ok";
      });
    },

    async createSpot(actor, routeId, fields) {
      return db.transaction(async (tx) => {
        const [route] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, routeId)).limit(1);
        if (!route) return null;
        const [row] = await tx
          .insert(spots)
          .values({ ...fields, routeId, sortOrder: await nextSpotOrder(tx, routeId) })
          .returning();
        // Every stamp place of a course is in that course's rally; the mound rally is managed separately.
        // The route's other points (a turn, a toilet) never are.
        const rallyId = row!.kind === "stamp" ? await courseRallyOf(tx, routeId) : null;
        if (rallyId) {
          const [m] = await tx.select({ m: max(rallySpots.position) }).from(rallySpots).where(eq(rallySpots.rallyId, rallyId));
          await tx.insert(rallySpots).values({ rallyId, spotId: row!.id, position: (m?.m ?? 0) + 1 }).onConflictDoNothing();
        }
        await writeAudit(tx, { actorUserId: actor, action: "spot.create", targetId: row!.id });
        return spotFromDb(row!);
      });
    },

    async updateSpot(actor, id, expected, changes) {
      return db.transaction(async (tx) => {
        const [before] = await tx.select({ status: spots.status, kind: spots.kind, routeId: spots.routeId }).from(spots).where(eq(spots.id, id)).limit(1);
        if (!before) return null;
        const statusChanged = changes.status !== undefined && changes.status !== before.status;
        const kindChanged = changes.kind !== undefined && changes.kind !== before.kind;
        if (kindChanged && before.kind === "stamp") {
          // A place visitors have stamped stays a stamp place.
          const [n] = await tx.select({ n: count() }).from(stamps).where(eq(stamps.spotId, id));
          if ((n?.n ?? 0) > 0) return "has_stamps";
        }
        const [row] = await tx
          .update(spots)
          .set({ ...changes, updatedAt: sql`clock_timestamp()`, ...(statusChanged ? { statusUpdatedAt: sql`clock_timestamp()` } : {}) })
          .where(and(eq(spots.id, id), sameInstant(spots.updatedAt, expected)))
          .returning();
        if (!row) return "conflict";
        if (kindChanged) {
          // Keep the rallies in step: a point that is no longer a stamp place leaves them, a new stamp place joins its course's.
          await tx.delete(rallySpots).where(eq(rallySpots.spotId, id));
          const rallyId = row.kind === "stamp" ? await courseRallyOf(tx, before.routeId) : null;
          if (rallyId) {
            const [m] = await tx.select({ m: max(rallySpots.position) }).from(rallySpots).where(eq(rallySpots.rallyId, rallyId));
            await tx.insert(rallySpots).values({ rallyId, spotId: id, position: (m?.m ?? 0) + 1 }).onConflictDoNothing();
          }
        }
        await writeAudit(tx, { actorUserId: actor, action: "spot.update", targetId: id });
        if (statusChanged) await writeAudit(tx, { actorUserId: actor, action: "spot.status.change", targetId: id });
        return spotFromDb(row);
      });
    },

    async setPublished(actor, id, published) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(spots)
          .set({ published, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(spots.id, id), eq(spots.published, !published)))
          .returning();
        if (!row) {
          // Missing, or already in that state: nothing to record.
          const [cur] = await tx.select().from(spots).where(eq(spots.id, id)).limit(1);
          return cur ? spotFromDb(cur) : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: published ? "spot.publish" : "spot.unpublish", targetId: id });
        return spotFromDb(row);
      });
    },

    async deleteSpot(actor, id) {
      return db.transaction(async (tx) => {
        const [exists] = await tx.select({ id: spots.id }).from(spots).where(eq(spots.id, id)).limit(1);
        if (!exists) return "not_found";
        const [n] = await tx.select({ n: count() }).from(stamps).where(eq(stamps.spotId, id));
        if ((n?.n ?? 0) > 0) return "has_stamps";
        await tx.delete(spots).where(eq(spots.id, id)); // its rally links go by cascade
        await writeAudit(tx, { actorUserId: actor, action: "spot.delete", targetId: id });
        return "ok";
      });
    },

    async reorderSpots(actor, routeId, ids) {
      return db.transaction(async (tx) => {
        const cur = await tx.select({ id: spots.id }).from(spots).where(eq(spots.routeId, routeId));
        if (ids.length !== cur.length || new Set(ids).size !== ids.length || !cur.every((s) => ids.includes(s.id))) return false;
        const rallyId = await courseRallyOf(tx, routeId);
        for (const [i, id] of ids.entries()) {
          await tx.update(spots).set({ sortOrder: i + 1 }).where(eq(spots.id, id));
          if (rallyId) await tx.update(rallySpots).set({ position: i + 1 }).where(and(eq(rallySpots.rallyId, rallyId), inArray(rallySpots.spotId, [id])));
        }
        await writeAudit(tx, { actorUserId: actor, action: "spot.reorder", targetId: routeId });
        return true;
      });
    },
  };
}

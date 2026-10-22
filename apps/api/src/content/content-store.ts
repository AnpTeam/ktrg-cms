import { and, asc, count, eq, getTableColumns, inArray, isNotNull, max, ne, or, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { rallySpots, routes, routeTranslations, spots, spotTranslations, stamps } from "../db/schema";
import { emptyTexts, flattenTexts, ROUTE_TEXT, SPOT_TEXT, splitTexts, type Texts } from "../db/translations";
import type { ContentStore, RouteRow, RouteSummaryRow, SpotRow } from "./content-types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;

/** The rows with their words (route_translations) joined in, in the flat shape the API uses. */
async function withRouteTexts(q: Reader, rows: (typeof routes.$inferSelect)[]): Promise<RouteRow[]> {
  const ids = rows.map((r) => r.id);
  const texts = ids.length ? await q.select().from(routeTranslations).where(inArray(routeTranslations.routeId, ids)) : [];
  const byRoute = flattenTexts(ROUTE_TEXT, texts, (t) => t.routeId);
  return rows.map((r) => {
    const t = byRoute.get(r.id) ?? emptyTexts(ROUTE_TEXT);
    return {
      ...r,
      ...t,
      nameJa: t.nameJa ?? "",
      prefecture: r.prefecture as RouteRow["prefecture"],
      walkStyle: r.walkStyle as RouteRow["walkStyle"],
      geometry: (r.geometry ?? null) as RouteRow["geometry"],
    };
  });
}

async function withSpotTexts(q: Reader, rows: (typeof spots.$inferSelect)[]): Promise<SpotRow[]> {
  const ids = rows.map((s) => s.id);
  const texts = ids.length ? await q.select().from(spotTranslations).where(inArray(spotTranslations.spotId, ids)) : [];
  const bySpot = flattenTexts(SPOT_TEXT, texts, (t) => t.spotId);
  return rows.map((s) => {
    const t = bySpot.get(s.id) ?? emptyTexts(SPOT_TEXT);
    return { ...s, ...t, nameJa: t.nameJa ?? "" };
  });
}
const routeFromDb = async (q: Reader, r: typeof routes.$inferSelect) => (await withRouteTexts(q, [r]))[0]!;
const spotFromDb = async (q: Reader, s: typeof spots.$inferSelect) => (await withSpotTexts(q, [s]))[0]!;

/**
 * Writes the given words, one row per language; fields left out keep their value. Update first, insert only
 * when the language has no row yet: an upsert would check the Japanese name rule against the partial insert
 * row (say, only a history) and fail. Callers have already locked the owner's row in the same transaction.
 */
async function saveRouteTexts(tx: Tx, routeId: string, texts: Texts<(typeof ROUTE_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(routeTranslations)
      .set(values)
      .where(and(eq(routeTranslations.routeId, routeId), eq(routeTranslations.locale, locale)))
      .returning({ locale: routeTranslations.locale });
    if (updated.length === 0) await tx.insert(routeTranslations).values({ routeId, locale, ...values });
  }
}

async function saveSpotTexts(tx: Tx, spotId: string, texts: Texts<(typeof SPOT_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(spotTranslations)
      .set(values)
      .where(and(eq(spotTranslations.spotId, spotId), eq(spotTranslations.locale, locale)))
      .returning({ locale: spotTranslations.locale });
    if (updated.length === 0) await tx.insert(spotTranslations).values({ spotId, locale, ...values });
  }
}

/**
 * The editor sends back the updatedAt it loaded. A JavaScript Date keeps milliseconds, the database keeps
 * microseconds, so compare at millisecond precision or every save would look like a conflict.
 */
const sameInstant = (column: typeof routes.updatedAt | typeof spots.updatedAt, expected: Date) =>
  sql`date_trunc('milliseconds', ${column}) = ${expected.toISOString()}::timestamptz`;

export function createDrizzleContentStore(db: Db): ContentStore {
  // Two admins adding at once would both read the same max: the lock makes the second wait until the first commits.
  const lockOrder = (tx: Tx, key: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  async function nextRouteOrder(tx: Tx): Promise<number> {
    await lockOrder(tx, "routes.sort_order");
    const [row] = await tx.select({ m: max(routes.sortOrder) }).from(routes);
    return (row?.m ?? 0) + 1;
  }
  async function nextSpotOrder(tx: Tx, routeId: string): Promise<number> {
    await lockOrder(tx, `spots.sort_order.${routeId}`);
    const [row] = await tx.select({ m: max(spots.sortOrder) }).from(spots).where(eq(spots.routeId, routeId));
    return (row?.m ?? 0) + 1;
  }

  return {
    async listRoutes() {
      // Without the legs (the editor's own copy of the line): the lists only need the line, and legs would double it.
      const rows = await db
        .select({ ...getTableColumns(routes), geometry: sql<(typeof routes.$inferSelect)["geometry"]>`${routes.geometry} - 'legs'`.as("geometry") })
        .from(routes)
        .orderBy(asc(routes.sortOrder));
      const counts = await db
        .select({
          routeId: spots.routeId,
          // Waypoints with a stamp and the route's other waypoints are counted apart.
          total: sql<number>`count(*) filter (where ${spots.stampable})`.mapWith(Number),
          published: sql<number>`count(*) filter (where ${spots.published} and ${spots.stampable})`.mapWith(Number),
          points: sql<number>`count(*) filter (where not ${spots.stampable})`.mapWith(Number),
        })
        .from(spots)
        .groupBy(spots.routeId);
      const byRoute = new Map(counts.map((c) => [c.routeId, c]));
      return (await withRouteTexts(db, rows)).map<RouteSummaryRow>((r) => ({
        ...r,
        spotCount: byRoute.get(r.id)?.total ?? 0,
        publishedSpotCount: byRoute.get(r.id)?.published ?? 0,
        pointCount: byRoute.get(r.id)?.points ?? 0,
      }));
    },

    async getRoute(id) {
      const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
      if (!route) return null;
      const list = await db.select().from(spots).where(eq(spots.routeId, id)).orderBy(asc(spots.sortOrder));
      return { route: await routeFromDb(db, route), spots: await withSpotTexts(db, list) };
    },

    async getSpot(id) {
      const [s] = await db.select().from(spots).where(eq(spots.id, id)).limit(1);
      return s ? spotFromDb(db, s) : null;
    },

    async listPublishedSpots() {
      return withSpotTexts(db, await db.select().from(spots).where(eq(spots.published, true)));
    },

    async createRoute(actor, fields) {
      const { rest, texts } = splitTexts(ROUTE_TEXT, fields);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(routes)
          .values({ ...rest, sortOrder: await nextRouteOrder(tx) })
          .returning();
        await saveRouteTexts(tx, row!.id, texts);
        await writeAudit(tx, { actorUserId: actor, action: "route.create", targetId: row!.id });
        return routeFromDb(tx, row!);
      });
    },

    async updateRoute(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(ROUTE_TEXT, changes);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(routes)
          .set({ ...rest, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(routes.id, id), sameInstant(routes.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await saveRouteTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: "route.update", targetId: id });
        return routeFromDb(tx, row);
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
        // Its place in rallies of courses (rally_routes) goes by cascade; the rallies themselves stay.
        await tx.delete(routes).where(eq(routes.id, id));
        await writeAudit(tx, { actorUserId: actor, action: "route.delete", targetId: id });
        return "ok";
      });
    },

    async createSpot(actor, routeId, fields) {
      const { rest, texts } = splitTexts(SPOT_TEXT, fields);
      return db.transaction(async (tx) => {
        const [route] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, routeId)).limit(1);
        if (!route) return null;
        const [row] = await tx
          .insert(spots)
          .values({ ...rest, routeId, sortOrder: await nextSpotOrder(tx, routeId) })
          .returning();
        await saveSpotTexts(tx, row!.id, texts);
        // A stamp place counts in its course (spots.route_id) and so in every rally of courses holding it; a rally of
        // places gets it only when an admin adds it there.
        await writeAudit(tx, { actorUserId: actor, action: "spot.create", targetId: row!.id });
        return spotFromDb(tx, row!);
      });
    },

    async updateSpot(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(SPOT_TEXT, changes);
      return db.transaction(async (tx) => {
        const [before] = await tx.select({ status: spots.status, stampable: spots.stampable, routeId: spots.routeId }).from(spots).where(eq(spots.id, id)).limit(1);
        if (!before) return null;
        const statusChanged = changes.status !== undefined && changes.status !== before.status;
        const switchedOff = changes.stampable === false && before.stampable;
        if (switchedOff) {
          // A place visitors have stamped stays a stamp place.
          const [n] = await tx.select({ n: count() }).from(stamps).where(eq(stamps.spotId, id));
          if ((n?.n ?? 0) > 0) return "has_stamps";
        }
        const [row] = await tx
          .update(spots)
          .set({ ...rest, updatedAt: sql`clock_timestamp()`, ...(statusChanged ? { statusUpdatedAt: sql`clock_timestamp()` } : {}) })
          .where(and(eq(spots.id, id), sameInstant(spots.updatedAt, expected)))
          .returning();
        if (!row) return "conflict";
        await saveSpotTexts(tx, id, texts);
        // A waypoint without a stamp leaves every rally of places (its course stops counting it by itself).
        if (switchedOff) await tx.delete(rallySpots).where(eq(rallySpots.spotId, id));
        await writeAudit(tx, { actorUserId: actor, action: "spot.update", targetId: id });
        if (statusChanged) await writeAudit(tx, { actorUserId: actor, action: "spot.status.change", targetId: id });
        return spotFromDb(tx, row);
      });
    },

    async setPublished(actor, id, published) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(spots)
          .set({ published, updatedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(spots.id, id),
              eq(spots.published, !published),
              // Publishing re-checks the rules in the same statement, so a place another admin moved a moment ago is not published.
              published ? and(isNotNull(spots.lat), isNotNull(spots.lng), eq(spots.positionVerified, true), eq(spots.permissionConfirmed, true)) : undefined,
            ),
          )
          .returning();
        if (!row) {
          // Missing, or already in that state: nothing to record.
          const [cur] = await tx.select().from(spots).where(eq(spots.id, id)).limit(1);
          return cur ? spotFromDb(tx, cur) : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: published ? "spot.publish" : "spot.unpublish", targetId: id });
        return spotFromDb(tx, row);
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
        for (const [i, id] of ids.entries()) await tx.update(spots).set({ sortOrder: i + 1 }).where(eq(spots.id, id));
        await writeAudit(tx, { actorUserId: actor, action: "spot.reorder", targetId: routeId });
        return true;
      });
    },
  };
}

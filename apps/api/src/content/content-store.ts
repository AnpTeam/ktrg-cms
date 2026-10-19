import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { rallies, rallySpots, routes, routeTranslations, spots, spotTranslations, stamps } from "../db/schema";
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
        // The route's own course rally goes with it (its links go by cascade).
        await tx.delete(rallies).where(and(eq(rallies.kind, "course"), eq(rallies.routeId, id)));
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
        // Every stamp place of a course is in that course's rally; the mound rally is managed separately.
        // The route's other points (a turn, a toilet) never are.
        const rallyId = row!.kind === "stamp" ? await courseRallyOf(tx, routeId) : null;
        if (rallyId) {
          const [m] = await tx.select({ m: max(rallySpots.position) }).from(rallySpots).where(eq(rallySpots.rallyId, rallyId));
          await tx.insert(rallySpots).values({ rallyId, spotId: row!.id, position: (m?.m ?? 0) + 1 }).onConflictDoNothing();
        }
        await writeAudit(tx, { actorUserId: actor, action: "spot.create", targetId: row!.id });
        return spotFromDb(tx, row!);
      });
    },

    async updateSpot(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(SPOT_TEXT, changes);
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
          .set({ ...rest, updatedAt: sql`clock_timestamp()`, ...(statusChanged ? { statusUpdatedAt: sql`clock_timestamp()` } : {}) })
          .where(and(eq(spots.id, id), sameInstant(spots.updatedAt, expected)))
          .returning();
        if (!row) return "conflict";
        await saveSpotTexts(tx, id, texts);
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
        return spotFromDb(tx, row);
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

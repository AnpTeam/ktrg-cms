import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { rallies, rallyCompletions, rallyRoutes, rallySpots, rallyTranslations, routes, routeTranslations, spots, spotTranslations } from "../db/schema";
import { emptyTexts, flattenTexts, RALLY_TEXT, ROUTE_TEXT, SPOT_TEXT, splitTexts, type Texts } from "../db/translations";
import type { RallyAdminStore, RallyCourse, RallyPlace, RallyRow } from "./rally-admin-types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;

/** The rallies with their names, member counts and finish counts, in the flat shape the API uses. */
async function withRallyDetails(q: Reader, rows: (typeof rallies.$inferSelect)[]): Promise<RallyRow[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const names = flattenTexts(RALLY_TEXT, await q.select().from(rallyTranslations).where(inArray(rallyTranslations.rallyId, ids)), (t) => t.rallyId);
  const countBy = async (table: typeof rallySpots | typeof rallyRoutes | typeof rallyCompletions) =>
    new Map(
      (await q.select({ rallyId: table.rallyId, n: count() }).from(table).where(inArray(table.rallyId, ids)).groupBy(table.rallyId)).map((c) => [c.rallyId, c.n]),
    );
  const [places, courses, finished] = [await countBy(rallySpots), await countBy(rallyRoutes), await countBy(rallyCompletions)];
  return rows.map((r) => {
    const t = names.get(r.id) ?? emptyTexts(RALLY_TEXT);
    return {
      id: r.id,
      kind: r.kind,
      nameJa: t.nameJa ?? "",
      nameEn: t.nameEn,
      sortOrder: r.sortOrder,
      published: r.published,
      memberCount: (r.kind === "places" ? places : courses).get(r.id) ?? 0,
      completionCount: finished.get(r.id) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** Stamp places with their names, in trail order (course order, then the place's order on it). */
async function stampPlaces(q: Reader, onlyIds?: string[]): Promise<RallyPlace[]> {
  if (onlyIds && onlyIds.length === 0) return [];
  const rows = await q
    .select({ id: spots.id, routeId: spots.routeId, published: spots.published })
    .from(spots)
    .innerJoin(routes, eq(routes.id, spots.routeId))
    .where(and(eq(spots.kind, "stamp"), onlyIds ? inArray(spots.id, onlyIds) : undefined))
    .orderBy(asc(routes.sortOrder), asc(spots.sortOrder));
  const ids = rows.map((s) => s.id);
  const names = ids.length ? flattenTexts(SPOT_TEXT, await q.select().from(spotTranslations).where(inArray(spotTranslations.spotId, ids)), (t) => t.spotId) : new Map();
  return rows.map((s) => {
    const t = names.get(s.id) ?? emptyTexts(SPOT_TEXT);
    return { spotId: s.id, routeId: s.routeId, nameJa: t.nameJa ?? "", nameEn: t.nameEn, published: s.published };
  });
}

/** Courses with their names and stamp place counts, in trail order. */
async function courseList(q: Reader, onlyIds?: string[]): Promise<RallyCourse[]> {
  if (onlyIds && onlyIds.length === 0) return [];
  const rows = await q.select({ id: routes.id }).from(routes).where(onlyIds ? inArray(routes.id, onlyIds) : undefined).orderBy(asc(routes.sortOrder));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const names = flattenTexts(ROUTE_TEXT, await q.select().from(routeTranslations).where(inArray(routeTranslations.routeId, ids)), (t) => t.routeId);
  const counts = await q
    .select({
      routeId: spots.routeId,
      total: sql<number>`count(*)`.mapWith(Number),
      published: sql<number>`count(*) filter (where ${spots.published})`.mapWith(Number),
    })
    .from(spots)
    .where(and(inArray(spots.routeId, ids), eq(spots.kind, "stamp")))
    .groupBy(spots.routeId);
  const byRoute = new Map(counts.map((c) => [c.routeId, c]));
  return rows.map((r) => {
    const t = names.get(r.id) ?? emptyTexts(ROUTE_TEXT);
    return {
      routeId: r.id,
      nameJa: t.nameJa ?? "",
      nameEn: t.nameEn,
      stampPlaceCount: byRoute.get(r.id)?.total ?? 0,
      publishedStampPlaceCount: byRoute.get(r.id)?.published ?? 0,
    };
  });
}

/** Writes the rally's names, one row per language (update first, insert when the language has no row yet). */
async function saveRallyTexts(tx: Tx, rallyId: string, texts: Texts<(typeof RALLY_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(rallyTranslations)
      .set(values)
      .where(and(eq(rallyTranslations.rallyId, rallyId), eq(rallyTranslations.locale, locale)))
      .returning({ locale: rallyTranslations.locale });
    if (updated.length === 0) await tx.insert(rallyTranslations).values({ rallyId, locale, ...values });
  }
}

/** The database keeps microseconds, a JavaScript Date milliseconds: compare at millisecond precision. */
const sameInstant = (expected: Date) => sql`date_trunc('milliseconds', ${rallies.updatedAt}) = ${expected.toISOString()}::timestamptz`;

/**
 * Bumps updatedAt only if the editor's copy is current: that both checks for a newer save and locks the rally row for
 * the rest of the transaction. null = no such rally, "conflict" = someone saved first.
 */
async function claim(tx: Tx, id: string, expected: Date) {
  const [row] = await tx.update(rallies).set({ updatedAt: sql`clock_timestamp()` }).where(and(eq(rallies.id, id), sameInstant(expected))).returning();
  if (row) return row;
  const [exists] = await tx.select({ id: rallies.id }).from(rallies).where(eq(rallies.id, id)).limit(1);
  return exists ? ("conflict" as const) : null;
}

export function createDrizzleRallyAdminStore(db: Db): RallyAdminStore {
  return {
    async listRallies() {
      return withRallyDetails(db, await db.select().from(rallies).orderBy(asc(rallies.sortOrder)));
    },

    async getRally(id) {
      const [row] = await db.select().from(rallies).where(eq(rallies.id, id)).limit(1);
      if (!row) return null;
      const rally = (await withRallyDetails(db, [row]))[0]!;
      if (rally.kind === "places") {
        const links = await db.select({ id: rallySpots.spotId, position: rallySpots.position }).from(rallySpots).where(eq(rallySpots.rallyId, id)).orderBy(asc(rallySpots.position));
        const byId = new Map((await stampPlaces(db, links.map((l) => l.id))).map((p) => [p.spotId, p]));
        const places = links.flatMap((l) => (byId.has(l.id) ? [{ ...byId.get(l.id)!, position: l.position }] : []));
        return { rally: { ...rally, kind: "places" as const }, places };
      }
      const links = await db.select({ id: rallyRoutes.routeId, position: rallyRoutes.position }).from(rallyRoutes).where(eq(rallyRoutes.rallyId, id)).orderBy(asc(rallyRoutes.position));
      const byId = new Map((await courseList(db, links.map((l) => l.id))).map((c) => [c.routeId, c]));
      const courses = links.flatMap((l) => (byId.has(l.id) ? [{ ...byId.get(l.id)!, position: l.position }] : []));
      return { rally: { ...rally, kind: "course" as const }, courses };
    },

    candidatePlaces: () => stampPlaces(db),
    candidateCourses: () => courseList(db),

    async createRally(actor, fields) {
      return db.transaction(async (tx) => {
        const [last] = await tx.select({ m: max(rallies.sortOrder) }).from(rallies);
        const [made] = await tx
          .insert(rallies)
          .values({ kind: fields.kind, sortOrder: (last?.m ?? 0) + 1, published: false })
          .returning();
        await saveRallyTexts(tx, made!.id, [
          { locale: "ja", values: { name: fields.nameJa } },
          ...(fields.nameEn ? [{ locale: "en" as const, values: { name: fields.nameEn } }] : []),
        ]);
        // All the members picked in the form, in one statement.
        const rallyId = made!.id;
        if (fields.memberIds.length > 0) {
          if (fields.kind === "places") {
            await tx.insert(rallySpots).values(fields.memberIds.map((spotId, i) => ({ rallyId, spotId, position: i + 1 })));
          } else {
            await tx.insert(rallyRoutes).values(fields.memberIds.map((routeId, i) => ({ rallyId, routeId, position: i + 1 })));
          }
        }
        await writeAudit(tx, { actorUserId: actor, action: "rally.create", targetId: made!.id });
        return (await withRallyDetails(tx, [made!]))[0]!;
      });
    },

    async updateRally(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(RALLY_TEXT, changes);
      return db.transaction(async (tx) => {
        const [before] = await tx.select({ published: rallies.published }).from(rallies).where(eq(rallies.id, id)).limit(1);
        const claimed = await claim(tx, id, expected);
        if (claimed === null || claimed === "conflict") return claimed;
        const [row] = Object.keys(rest).length ? await tx.update(rallies).set(rest).where(eq(rallies.id, id)).returning() : [claimed];
        await saveRallyTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: "rally.update", targetId: id });
        if (changes.published !== undefined && changes.published !== before?.published) {
          await writeAudit(tx, { actorUserId: actor, action: changes.published ? "rally.publish" : "rally.unpublish", targetId: id });
        }
        return (await withRallyDetails(tx, [row!]))[0]!;
      });
    },

    async reorderRallies(actor, ids) {
      return db.transaction(async (tx) => {
        const all = await tx.select({ id: rallies.id }).from(rallies);
        if (ids.length !== all.length || new Set(ids).size !== ids.length || !all.every((r) => ids.includes(r.id))) return false;
        for (const [i, id] of ids.entries()) await tx.update(rallies).set({ sortOrder: i + 1 }).where(eq(rallies.id, id));
        await writeAudit(tx, { actorUserId: actor, action: "rally.reorder", targetId: null });
        return true;
      });
    },

    async setPlaces(actor, id, expected, spotIds) {
      return db.transaction(async (tx) => {
        const row = await claim(tx, id, expected);
        if (row === null || row === "conflict") return row;
        await tx.delete(rallySpots).where(eq(rallySpots.rallyId, id));
        if (spotIds.length) await tx.insert(rallySpots).values(spotIds.map((spotId, i) => ({ rallyId: id, spotId, position: i + 1 })));
        await writeAudit(tx, { actorUserId: actor, action: "rally.members.update", targetId: id });
        return (await withRallyDetails(tx, [row]))[0]!;
      });
    },

    async setCourses(actor, id, expected, routeIds) {
      return db.transaction(async (tx) => {
        const row = await claim(tx, id, expected);
        if (row === null || row === "conflict") return row;
        await tx.delete(rallyRoutes).where(eq(rallyRoutes.rallyId, id));
        if (routeIds.length) await tx.insert(rallyRoutes).values(routeIds.map((routeId, i) => ({ rallyId: id, routeId, position: i + 1 })));
        await writeAudit(tx, { actorUserId: actor, action: "rally.members.update", targetId: id });
        return (await withRallyDetails(tx, [row]))[0]!;
      });
    },

    async deleteRally(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(rallies).where(eq(rallies.id, id)).returning({ id: rallies.id }); // links and finishes by cascade
        if (!gone) return "not_found";
        await writeAudit(tx, { actorUserId: actor, action: "rally.delete", targetId: id });
        return "ok";
      });
    },
  };
}

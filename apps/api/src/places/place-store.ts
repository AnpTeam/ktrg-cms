import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { places, placeTranslations } from "../db/schema";
import { emptyTexts, flattenTexts, PLACE_TEXT, splitTexts, type Texts } from "../db/translations";
import { PLACE_AUDIT, type PlaceRow, type PlaceStore } from "./place-directory";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;

async function withTexts(q: Reader, rows: (typeof places.$inferSelect)[]): Promise<PlaceRow[]> {
  if (rows.length === 0) return [];
  const words = flattenTexts(PLACE_TEXT, await q.select().from(placeTranslations).where(inArray(placeTranslations.placeId, rows.map((r) => r.id))), (t) => t.placeId);
  return rows.map((r) => {
    const w = words.get(r.id) ?? emptyTexts(PLACE_TEXT);
    return { ...r, ...w, nameJa: w.nameJa ?? "" };
  });
}

/** Update first, insert when the language has no row yet (an upsert would trip the "ja needs a name" check). */
async function saveTexts(tx: Tx, placeId: string, texts: Texts<(typeof PLACE_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(placeTranslations)
      .set(values)
      .where(and(eq(placeTranslations.placeId, placeId), eq(placeTranslations.locale, locale)))
      .returning({ locale: placeTranslations.locale });
    if (updated.length === 0) await tx.insert(placeTranslations).values({ placeId, locale, ...values });
  }
}

export function createDrizzlePlaceStore(db: Db): PlaceStore {
  return {
    async list(cursor, limit) {
      return withTexts(db, await db.select().from(places).where(afterCursor(places.createdAt, places.id, cursor)).orderBy(...newestFirst(places.createdAt, places.id)).limit(limit));
    },
    async get(id) {
      const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },
    async create(actor, fields) {
      const { rest, texts } = splitTexts(PLACE_TEXT, fields);
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(places).values(rest).returning();
        await saveTexts(tx, made!.id, texts);
        await writeAudit(tx, { actorUserId: actor, action: PLACE_AUDIT.create, targetId: made!.id });
        return (await withTexts(tx, [made!]))[0]!;
      });
    },
    async update(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(PLACE_TEXT, changes);
      return db.transaction(async (tx) => {
        // Bumps updatedAt only if the editor's copy is current: that checks for a newer save and locks the row.
        const [row] = await tx
          .update(places)
          .set({ ...rest, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(places.id, id), sameInstant(places.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: places.id }).from(places).where(eq(places.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await saveTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: PLACE_AUDIT.update, targetId: id });
        return (await withTexts(tx, [row]))[0]!;
      });
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(places).where(eq(places.id, id)).returning({ id: places.id }); // words by cascade
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: PLACE_AUDIT.delete, targetId: id });
        return true;
      });
    },
    async listPublic() {
      return withTexts(db, await db.select().from(places).where(eq(places.published, true)).orderBy(desc(places.createdAt)));
    },
  };
}

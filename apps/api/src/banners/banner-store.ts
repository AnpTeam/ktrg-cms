import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { banners, bannerTranslations } from "../db/schema";
import { BANNER_TEXT, emptyTexts, flattenTexts, splitTexts, type Texts } from "../db/translations";
import { BANNER_AUDIT, type BannerRow, type BannerStore } from "./banner-list";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;

async function withTexts(q: Reader, rows: (typeof banners.$inferSelect)[]): Promise<BannerRow[]> {
  if (rows.length === 0) return [];
  const words = flattenTexts(BANNER_TEXT, await q.select().from(bannerTranslations).where(inArray(bannerTranslations.bannerId, rows.map((r) => r.id))), (t) => t.bannerId);
  return rows.map((r) => {
    const w = words.get(r.id) ?? emptyTexts(BANNER_TEXT);
    return { ...r, altJa: w.altJa ?? "", altEn: w.altEn };
  });
}

/** Update first, insert when the language has no row yet (an upsert would trip the "ja needs alt" check; CLAUDE.md). */
async function saveTexts(tx: Tx, bannerId: string, texts: Texts<(typeof BANNER_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(bannerTranslations)
      .set(values)
      .where(and(eq(bannerTranslations.bannerId, bannerId), eq(bannerTranslations.locale, locale)))
      .returning({ locale: bannerTranslations.locale });
    if (updated.length === 0) await tx.insert(bannerTranslations).values({ bannerId, locale, ...values });
  }
}

export function createDrizzleBannerStore(db: Db): BannerStore {
  return {
    async list(cursor, limit) {
      return withTexts(db, await db.select().from(banners).where(afterCursor(banners.createdAt, banners.id, cursor)).orderBy(...newestFirst(banners.createdAt, banners.id)).limit(limit));
    },
    async get(id) {
      const [row] = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },
    async create(actor, fields) {
      const { rest, texts } = splitTexts(BANNER_TEXT, fields);
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(banners).values(rest).returning();
        await saveTexts(tx, made!.id, texts);
        await writeAudit(tx, { actorUserId: actor, action: BANNER_AUDIT.create, targetId: made!.id });
        return (await withTexts(tx, [made!]))[0]!;
      });
    },
    async update(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(BANNER_TEXT, changes);
      return db.transaction(async (tx) => {
        // Bumps updatedAt only if the editor's copy is current: that checks for a newer save and locks the row.
        const [row] = await tx
          .update(banners)
          .set({ ...rest, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(banners.id, id), sameInstant(banners.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: banners.id }).from(banners).where(eq(banners.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await saveTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: BANNER_AUDIT.update, targetId: id });
        return (await withTexts(tx, [row]))[0]!;
      });
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(banners).where(eq(banners.id, id)).returning({ id: banners.id }); // words by cascade
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: BANNER_AUDIT.delete, targetId: id });
        return true;
      });
    },
    async listPublic() {
      return withTexts(db, await db.select().from(banners).where(eq(banners.published, true)).orderBy(asc(banners.sortOrder), asc(banners.createdAt)));
    },
  };
}

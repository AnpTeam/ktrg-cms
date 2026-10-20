import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import type { Db } from "../db/client";
import { routes, trailNotices, trailNoticeTranslations } from "../db/schema";
import { emptyTexts, flattenTexts, NOTICE_TEXT, splitTexts, type Texts } from "../db/translations";
import { NOTICE_AUDIT } from "./notice-memory-store";
import type { NoticeRow, NoticeStore } from "./notice-types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;


/** Notice rows with their words, in the flat shape the API uses. */
async function withTexts(q: Reader, rows: (typeof trailNotices.$inferSelect)[]): Promise<NoticeRow[]> {
  if (rows.length === 0) return [];
  const words = flattenTexts(
    NOTICE_TEXT,
    await q.select().from(trailNoticeTranslations).where(inArray(trailNoticeTranslations.trailNoticeId, rows.map((r) => r.id))),
    (t) => t.trailNoticeId,
  );
  return rows.map((r) => {
    const w = words.get(r.id) ?? emptyTexts(NOTICE_TEXT);
    return {
      id: r.id,
      routeId: r.routeId,
      titleJa: w.titleJa ?? "",
      titleEn: w.titleEn,
      bodyJa: w.bodyJa ?? "",
      bodyEn: w.bodyEn,
      sourceUrl: r.sourceUrl,
      sourceNameJa: w.sourceNameJa ?? "",
      sourceNameEn: w.sourceNameEn,
      translations: w.translations,
      verifiedOn: r.verifiedOn,
      expiresOn: r.expiresOn,
      published: r.published,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** Writes the words, one row per language (update first, insert when the language has no row yet; see CLAUDE.md). */
async function saveTexts(tx: Tx, noticeId: string, texts: Texts<(typeof NOTICE_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(trailNoticeTranslations)
      .set(values)
      .where(and(eq(trailNoticeTranslations.trailNoticeId, noticeId), eq(trailNoticeTranslations.locale, locale)))
      .returning({ locale: trailNoticeTranslations.locale });
    if (updated.length === 0) await tx.insert(trailNoticeTranslations).values({ trailNoticeId: noticeId, locale, ...values });
  }
}

export function createDrizzleNoticeStore(db: Db): NoticeStore {
  return {
    async list(cursor, limit) {
      const rows = await db
        .select()
        .from(trailNotices)
        .where(afterCursor(trailNotices.createdAt, trailNotices.id, cursor))
        .orderBy(...newestFirst(trailNotices.createdAt, trailNotices.id))
        .limit(limit);
      return withTexts(db, rows);
    },

    async get(id) {
      const [row] = await db.select().from(trailNotices).where(eq(trailNotices.id, id)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },

    async create(actor, fields) {
      const { rest, texts } = splitTexts(NOTICE_TEXT, fields);
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(trailNotices).values(rest).returning();
        await saveTexts(tx, made!.id, texts);
        await writeAudit(tx, { actorUserId: actor, action: NOTICE_AUDIT.create, targetId: made!.id });
        return (await withTexts(tx, [made!]))[0]!;
      });
    },

    async update(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(NOTICE_TEXT, changes);
      return db.transaction(async (tx) => {
        // Bumps updatedAt only if the editor's copy is current: that checks for a newer save and locks the row.
        const [row] = await tx
          .update(trailNotices)
          .set({ ...rest, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(trailNotices.id, id), sameInstant(trailNotices.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: trailNotices.id }).from(trailNotices).where(eq(trailNotices.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await saveTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: NOTICE_AUDIT.update, targetId: id });
        return (await withTexts(tx, [row]))[0]!;
      });
    },

    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(trailNotices).where(eq(trailNotices.id, id)).returning({ id: trailNotices.id }); // words by cascade
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: NOTICE_AUDIT.delete, targetId: id });
        return true;
      });
    },

    async routeExists(id) {
      const [row] = await db.select({ id: routes.id }).from(routes).where(eq(routes.id, id)).limit(1);
      return row !== undefined;
    },

    async listPublic(today) {
      const rows = await db
        .select()
        .from(trailNotices)
        .where(and(eq(trailNotices.published, true), or(isNull(trailNotices.expiresOn), gte(trailNotices.expiresOn, today))))
        .orderBy(desc(trailNotices.verifiedOn), desc(trailNotices.createdAt));
      return withTexts(db, rows);
    },
  };
}

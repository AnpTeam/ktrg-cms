import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { blogPosts, blogPostTranslations } from "../db/schema";
import { emptyTexts, flattenTexts, POST_TEXT, splitTexts, type Texts } from "../db/translations";
import { POST_AUDIT, PUBLIC_POSTS_LIMIT, type PostRow, type PostStore } from "./post-list";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Pick<Db, "select">;

/** Post rows with their words, in the flat shape the API uses. */
async function withTexts(q: Reader, rows: (typeof blogPosts.$inferSelect)[]): Promise<PostRow[]> {
  if (rows.length === 0) return [];
  const words = flattenTexts(
    POST_TEXT,
    await q.select().from(blogPostTranslations).where(inArray(blogPostTranslations.blogPostId, rows.map((r) => r.id))),
    (t) => t.blogPostId,
  );
  return rows.map((r) => {
    const w = words.get(r.id) ?? emptyTexts(POST_TEXT);
    return {
      id: r.id,
      titleJa: w.titleJa ?? "",
      titleEn: w.titleEn,
      bodyJa: w.bodyJa ?? "",
      bodyEn: w.bodyEn,
      authorNameJa: w.authorNameJa,
      authorNameEn: w.authorNameEn,
      coverPhotoUrl: r.coverPhotoUrl,
      coverCredit: r.coverCredit,
      authorPhotoUrl: r.authorPhotoUrl,
      translations: w.translations,
      publishedOn: r.publishedOn,
      published: r.published,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** Writes the words, one row per language (update first, insert when the language has no row yet; see CLAUDE.md). */
async function saveTexts(tx: Tx, postId: string, texts: Texts<(typeof POST_TEXT)[number]>) {
  for (const { locale, values } of texts) {
    const updated = await tx
      .update(blogPostTranslations)
      .set(values)
      .where(and(eq(blogPostTranslations.blogPostId, postId), eq(blogPostTranslations.locale, locale)))
      .returning({ locale: blogPostTranslations.locale });
    if (updated.length === 0) await tx.insert(blogPostTranslations).values({ blogPostId: postId, locale, ...values });
  }
}

/** Published and dated today or earlier: what a visitor may read. */
const readable = (today: string) => and(eq(blogPosts.published, true), lte(blogPosts.publishedOn, today));

export function createDrizzlePostStore(db: Db): PostStore {
  return {
    async list(cursor, limit) {
      const rows = await db
        .select()
        .from(blogPosts)
        .where(afterCursor(blogPosts.createdAt, blogPosts.id, cursor))
        .orderBy(...newestFirst(blogPosts.createdAt, blogPosts.id))
        .limit(limit);
      return withTexts(db, rows);
    },

    async get(id) {
      const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },

    async create(actor, fields) {
      const { rest, texts } = splitTexts(POST_TEXT, fields);
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(blogPosts).values(rest).returning();
        await saveTexts(tx, made!.id, texts);
        await writeAudit(tx, { actorUserId: actor, action: POST_AUDIT.create, targetId: made!.id });
        return (await withTexts(tx, [made!]))[0]!;
      });
    },

    async update(actor, id, expected, changes) {
      const { rest, texts } = splitTexts(POST_TEXT, changes);
      return db.transaction(async (tx) => {
        // Bumps updatedAt only if the editor's copy is current: that checks for a newer save and locks the row.
        const [row] = await tx
          .update(blogPosts)
          .set({ ...rest, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(blogPosts.id, id), sameInstant(blogPosts.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await saveTexts(tx, id, texts);
        await writeAudit(tx, { actorUserId: actor, action: POST_AUDIT.update, targetId: id });
        return (await withTexts(tx, [row]))[0]!;
      });
    },

    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(blogPosts).where(eq(blogPosts.id, id)).returning({ id: blogPosts.id }); // words by cascade
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: POST_AUDIT.delete, targetId: id });
        return true;
      });
    },

    async listPublic(today) {
      const rows = await db
        .select()
        .from(blogPosts)
        .where(readable(today))
        .orderBy(desc(blogPosts.publishedOn), desc(blogPosts.createdAt))
        .limit(PUBLIC_POSTS_LIMIT);
      return withTexts(db, rows);
    },

    async getPublic(id, today) {
      const [row] = await db.select().from(blogPosts).where(and(eq(blogPosts.id, id), readable(today))).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },
  };
}

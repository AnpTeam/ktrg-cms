import { and, arrayContains, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { blogAuthors, blogPosts, blogPostTranslations, blogTags, users } from "../db/schema";
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
  // The account behind each post: its profile name and photo are the byline unless the post names someone else.
  const authorIds = [...new Set(rows.flatMap((r) => (r.authorUserId ? [r.authorUserId] : [])))];
  const accounts = new Map(
    (authorIds.length === 0 ? [] : await q.select({ id: users.id, name: users.displayName, photo: users.avatarUrl }).from(users).where(inArray(users.id, authorIds))).map((u) => [u.id, u]),
  );
  const writerIds = [...new Set(rows.flatMap((r) => (r.authorId ? [r.authorId] : [])))];
  const writers = new Map(
    (writerIds.length === 0 ? [] : await q.select().from(blogAuthors).where(inArray(blogAuthors.id, writerIds))).map((a) => [a.id, { nameJa: a.nameJa, nameEn: a.nameEn, photoUrl: a.photoUrl }]),
  );
  // The tags of these posts by id; a deleted tag is simply not found, and left out.
  const tagIds = [...new Set(rows.flatMap((r) => r.tagIds))];
  const tags = new Map((tagIds.length === 0 ? [] : await q.select().from(blogTags).where(inArray(blogTags.id, tagIds))).map((t) => [t.id, { id: t.id, nameJa: t.nameJa, nameEn: t.nameEn }]));
  return rows.map((r) => {
    const w = words.get(r.id) ?? emptyTexts(POST_TEXT);
    const account = r.authorUserId ? accounts.get(r.authorUserId) : undefined;
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
      placeId: r.placeId,
      routeId: r.routeId,
      spotId: r.spotId,
      authorId: r.authorId,
      writer: r.authorId ? (writers.get(r.authorId) ?? null) : null,
      authorUserId: r.authorUserId,
      accountName: account?.name ?? null,
      accountPhotoUrl: account?.photo ?? null,
      translations: w.translations,
      publishedOn: r.publishedOn,
      kind: r.kind,
      slug: r.slug,
      tagIds: r.tagIds,
      tags: r.tagIds.flatMap((id) => tags.get(id) ?? []),
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
const isPost = eq(blogPosts.kind, "post");
const isPage = eq(blogPosts.kind, "page");

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
        const [made] = await tx.insert(blogPosts).values({ ...rest, authorUserId: actor }).returning();
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

    async listPublic(today, tagId, offset = 0, limit = PUBLIC_POSTS_LIMIT) {
      const rows = await db
        .select()
        .from(blogPosts)
        .where(and(readable(today), isPost, tagId ? arrayContains(blogPosts.tagIds, [tagId]) : undefined))
        .orderBy(desc(blogPosts.publishedOn), desc(blogPosts.createdAt), desc(blogPosts.id)) // the id keeps pages from repeating or skipping posts made at one instant
        .limit(limit)
        .offset(offset);
      return withTexts(db, rows);
    },

    async getPublic(id, today) {
      const [row] = await db.select().from(blogPosts).where(and(eq(blogPosts.id, id), readable(today), isPost)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },

    async findBySlug(slug) {
      const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },

    async listPublicPages(today) {
      const rows = await db.select().from(blogPosts).where(and(readable(today), isPage)).orderBy(asc(blogPosts.createdAt)).limit(PUBLIC_POSTS_LIMIT);
      return withTexts(db, rows);
    },

    async getPublicPage(slug, today) {
      const [row] = await db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), readable(today), isPage)).limit(1);
      return row ? (await withTexts(db, [row]))[0]! : null;
    },
  };
}

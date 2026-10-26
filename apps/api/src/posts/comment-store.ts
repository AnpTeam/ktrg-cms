import { and, asc, eq, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { blogComments, blogPostTranslations, users } from "../db/schema";
import { COMMENT_AUDIT, type CommentRow, type CommentStore } from "./comments";

const select = (db: Pick<Db, "select">) =>
  db
    .select({
      id: blogComments.id,
      postId: blogComments.postId,
      postTitle: sql<string>`coalesce(${blogPostTranslations.title}, '')`,
      authorName: users.displayName,
      body: blogComments.body,
      status: blogComments.status,
      createdAt: blogComments.createdAt,
      updatedAt: blogComments.updatedAt,
    })
    .from(blogComments)
    .leftJoin(users, eq(users.id, blogComments.userId))
    .leftJoin(blogPostTranslations, and(eq(blogPostTranslations.blogPostId, blogComments.postId), eq(blogPostTranslations.locale, "ja")));

export function createDrizzleCommentStore(db: Db): CommentStore {
  return {
    list: (cursor, limit) => select(db).where(afterCursor(blogComments.createdAt, blogComments.id, cursor)).orderBy(...newestFirst(blogComments.createdAt, blogComments.id)).limit(limit) as Promise<CommentRow[]>,
    async get(id) {
      const [row] = await select(db).where(eq(blogComments.id, id)).limit(1);
      return (row as CommentRow | undefined) ?? null;
    },
    async create(userId, postId, body, status) {
      const [made] = await db.insert(blogComments).values({ userId, postId, body, status }).returning({ id: blogComments.id });
      const [row] = await select(db).where(eq(blogComments.id, made!.id)).limit(1);
      return row as CommentRow;
    },
    async setStatus(actor, id, expected, status) {
      return db.transaction(async (tx) => {
        const [hit] = await tx
          .update(blogComments)
          .set({ status, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(blogComments.id, id), sameInstant(blogComments.updatedAt, expected)))
          .returning({ id: blogComments.id });
        if (!hit) {
          const [exists] = await tx.select({ id: blogComments.id }).from(blogComments).where(eq(blogComments.id, id)).limit(1);
          return exists ? ("conflict" as const) : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: COMMENT_AUDIT.update, targetId: id });
        const [row] = await select(tx).where(eq(blogComments.id, id)).limit(1);
        return row as CommentRow;
      });
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(blogComments).where(eq(blogComments.id, id)).returning({ id: blogComments.id });
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: COMMENT_AUDIT.delete, targetId: id });
        return true;
      });
    },
    listApproved: (postId, limit) => select(db).where(and(eq(blogComments.postId, postId), eq(blogComments.status, "approved"))).orderBy(asc(blogComments.createdAt)).limit(limit) as Promise<CommentRow[]>,
  };
}

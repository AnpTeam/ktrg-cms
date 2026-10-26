import { and, eq, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { blogAuthors } from "../db/schema";
import { AUTHOR_AUDIT, type AuthorStore } from "./author-list";

export function createDrizzleAuthorStore(db: Db): AuthorStore {
  return {
    list: (cursor, limit) => db.select().from(blogAuthors).where(afterCursor(blogAuthors.createdAt, blogAuthors.id, cursor)).orderBy(...newestFirst(blogAuthors.createdAt, blogAuthors.id)).limit(limit),
    async get(id) {
      const [row] = await db.select().from(blogAuthors).where(eq(blogAuthors.id, id)).limit(1);
      return row ?? null;
    },
    async create(actor, fields) {
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(blogAuthors).values(fields).returning();
        await writeAudit(tx, { actorUserId: actor, action: AUTHOR_AUDIT.create, targetId: made!.id });
        return made!;
      });
    },
    async update(actor, id, expected, changes) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(blogAuthors)
          .set({ ...changes, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(blogAuthors.id, id), sameInstant(blogAuthors.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: blogAuthors.id }).from(blogAuthors).where(eq(blogAuthors.id, id)).limit(1);
          return exists ? ("conflict" as const) : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: AUTHOR_AUDIT.update, targetId: id });
        return row;
      });
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(blogAuthors).where(eq(blogAuthors.id, id)).returning({ id: blogAuthors.id });
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: AUTHOR_AUDIT.delete, targetId: id });
        return true;
      });
    },
  };
}

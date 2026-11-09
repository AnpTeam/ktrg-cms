import { and, eq, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { blogTags } from "../db/schema";
import { TAG_AUDIT, type TagStore } from "./tag-list";

export function createDrizzleTagStore(db: Db): TagStore {
  return {
    list: (cursor, limit) => db.select().from(blogTags).where(afterCursor(blogTags.createdAt, blogTags.id, cursor)).orderBy(...newestFirst(blogTags.createdAt, blogTags.id)).limit(limit),
    async get(id) {
      const [row] = await db.select().from(blogTags).where(eq(blogTags.id, id)).limit(1);
      return row ?? null;
    },
    async create(actor, fields) {
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(blogTags).values(fields).returning();
        await writeAudit(tx, { actorUserId: actor, action: TAG_AUDIT.create, targetId: made!.id });
        return made!;
      });
    },
    async update(actor, id, expected, changes) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(blogTags)
          .set({ ...changes, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(blogTags.id, id), sameInstant(blogTags.updatedAt, expected)))
          .returning();
        if (!row) {
          const [exists] = await tx.select({ id: blogTags.id }).from(blogTags).where(eq(blogTags.id, id)).limit(1);
          return exists ? ("conflict" as const) : null;
        }
        await writeAudit(tx, { actorUserId: actor, action: TAG_AUDIT.update, targetId: id });
        return row;
      });
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(blogTags).where(eq(blogTags.id, id)).returning({ id: blogTags.id });
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: TAG_AUDIT.delete, targetId: id });
        return true;
      });
    },
  };
}

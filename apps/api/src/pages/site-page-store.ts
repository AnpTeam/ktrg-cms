import { and, asc, eq, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { sitePages } from "../db/schema";
import { SITE_PAGE_AUDIT, type SitePageStore } from "./site-pages";

const isUniqueViolation = (err: unknown) => (err as { code?: string; cause?: { code?: string } })?.code === "23505" || (err as { cause?: { code?: string } })?.cause?.code === "23505";

export function createDrizzleSitePageStore(db: Db): SitePageStore {
  return {
    list: (cursor, limit) => db.select().from(sitePages).where(afterCursor(sitePages.createdAt, sitePages.id, cursor)).orderBy(...newestFirst(sitePages.createdAt, sitePages.id)).limit(limit),
    async get(id) {
      const [row] = await db.select().from(sitePages).where(eq(sitePages.id, id)).limit(1);
      return row ?? null;
    },
    async create(actor, fields) {
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(sitePages).values(fields).returning();
        await writeAudit(tx, { actorUserId: actor, action: SITE_PAGE_AUDIT.create, targetId: made!.id });
        return made!;
      });
    },
    async update(actor, id, expected, changes) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx
            .update(sitePages)
            .set({ ...changes, updatedAt: sql`clock_timestamp()` })
            .where(and(eq(sitePages.id, id), sameInstant(sitePages.updatedAt, expected)))
            .returning();
          if (!row) {
            const [exists] = await tx.select({ id: sitePages.id }).from(sitePages).where(eq(sitePages.id, id)).limit(1);
            return exists ? ("conflict" as const) : null;
          }
          await writeAudit(tx, { actorUserId: actor, action: SITE_PAGE_AUDIT.update, targetId: id });
          return row;
        });
      } catch (err) {
        if (isUniqueViolation(err)) return "conflict"; // the address was taken in the meantime
        throw err;
      }
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(sitePages).where(eq(sitePages.id, id)).returning({ id: sitePages.id });
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: SITE_PAGE_AUDIT.delete, targetId: id });
        return true;
      });
    },
    async findBySlug(slug) {
      const [row] = await db.select().from(sitePages).where(eq(sitePages.slug, slug)).limit(1);
      return row ?? null;
    },
    listPublished: () => db.select().from(sitePages).where(eq(sitePages.published, true)).orderBy(asc(sitePages.createdAt)),
  };
}

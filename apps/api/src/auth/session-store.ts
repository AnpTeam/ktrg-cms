import { and, eq, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";
import type { SessionStore } from "./session-service";

export function createDrizzleSessionStore(db: Db): SessionStore {
  return {
    async create({ userId, tokenHash, expiresAt, absoluteExpiresAt, now, lastLoginAt }) {
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt,
        absoluteExpiresAt,
        lastSeenAt: now,
        lastLoginAt,
      });
    },

    async find(tokenHash) {
      const [row] = await db
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          absoluteExpiresAt: sessions.absoluteExpiresAt,
          lastLoginAt: sessions.lastLoginAt,
          userId: users.id,
          email: users.email,
          role: users.role,
          locale: users.locale,
          restrictedAt: users.restrictedAt,
          restrictedUntil: users.restrictedUntil,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      if (!row) return null;
      return {
        session: {
          id: row.id,
          expiresAt: row.expiresAt,
          absoluteExpiresAt: row.absoluteExpiresAt,
          lastLoginAt: row.lastLoginAt,
        },
        user: { id: row.userId, email: row.email, role: row.role, locale: row.locale, restricted: row.restrictedAt !== null && (row.restrictedUntil === null || row.restrictedUntil > new Date()) },
      };
    },

    async touch(id, lastSeenAt, expiresAt) {
      await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, id));
    },

    async remove(tokenHash) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },

    async markFresh(id, at) {
      await db.update(sessions).set({ lastLoginAt: at }).where(eq(sessions.id, id));
    },

    async removeAll(userId) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },

    async removeOthers(userId, keepSessionId) {
      await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
    },
  };
}

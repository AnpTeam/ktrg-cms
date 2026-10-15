import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";
import type { SessionStore } from "./session-service";

export function createDrizzleSessionStore(db: Db): SessionStore {
  return {
    async create({ userId, tokenHash, expiresAt, absoluteExpiresAt, now }) {
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt,
        absoluteExpiresAt,
        lastSeenAt: now,
        lastLoginAt: now,
      });
    },

    async find(tokenHash) {
      const [row] = await db
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          absoluteExpiresAt: sessions.absoluteExpiresAt,
          userId: users.id,
          email: users.email,
          role: users.role,
          locale: users.locale,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      if (!row) return null;
      return {
        session: { id: row.id, expiresAt: row.expiresAt, absoluteExpiresAt: row.absoluteExpiresAt },
        user: { id: row.userId, email: row.email, role: row.role, locale: row.locale },
      };
    },

    async touch(id, lastSeenAt, expiresAt) {
      await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, id));
    },

    async remove(tokenHash) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
  };
}

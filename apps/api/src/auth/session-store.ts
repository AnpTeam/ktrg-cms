import { and, eq, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";
import type { SessionStore } from "./session-service";

export function createDrizzleSessionStore(db: Db): SessionStore {
  return {
    async create({ userId, tokenHash, expiresAt, absoluteExpiresAt, now, lastLoginAt, staffCheckedUntil }) {
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt,
        absoluteExpiresAt,
        lastSeenAt: now,
        lastLoginAt,
        staffCheckedUntil,
      });
    },

    async find(tokenHash) {
      const [row] = await db
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          absoluteExpiresAt: sessions.absoluteExpiresAt,
          lastLoginAt: sessions.lastLoginAt,
          staffCheckedUntil: sessions.staffCheckedUntil,
          rotatedAt: sessions.rotatedAt,
          previousTokenHash: sessions.previousTokenHash,
          userId: users.id,
          email: users.email,
          role: users.role,
          locale: users.locale,
          restrictedAt: users.restrictedAt,
          restrictedUntil: users.restrictedUntil,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(or(eq(sessions.tokenHash, tokenHash), eq(sessions.previousTokenHash, tokenHash)))
        .limit(1);
      if (!row) return null;
      return {
        session: {
          id: row.id,
          expiresAt: row.expiresAt,
          absoluteExpiresAt: row.absoluteExpiresAt,
          lastLoginAt: row.lastLoginAt,
          staffCheckedUntil: row.staffCheckedUntil,
          rotatedAt: row.rotatedAt,
          rotating: row.previousTokenHash !== null,
          viaPrevious: row.previousTokenHash === tokenHash,
        },
        user: { id: row.userId, email: row.email, role: row.role, locale: row.locale, restricted: row.restrictedAt !== null && (row.restrictedUntil === null || row.restrictedUntil > new Date()) },
      };
    },

    async touch(id, lastSeenAt, expiresAt) {
      await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, id));
    },

    async rotate(id, tokenHash, at) {
      await db
        .update(sessions)
        .set({ previousTokenHash: sql`coalesce(${sessions.previousTokenHash}, ${sessions.tokenHash})`, tokenHash, rotatedAt: at })
        .where(eq(sessions.id, id));
    },

    async settle(id) {
      await db.update(sessions).set({ previousTokenHash: null }).where(eq(sessions.id, id));
    },

    async remove(tokenHash) {
      await db.delete(sessions).where(or(eq(sessions.tokenHash, tokenHash), eq(sessions.previousTokenHash, tokenHash)));
    },

    async markFresh(id, at, staffCheckedUntil) {
      await db
        .update(sessions)
        .set({ lastLoginAt: at, staffCheckedUntil: sql`greatest(${sessions.staffCheckedUntil}, ${staffCheckedUntil.toISOString()}::timestamptz)` })
        .where(eq(sessions.id, id));
    },

    async keepStaffCheck(id, until) {
      await db.update(sessions).set({ staffCheckedUntil: until }).where(eq(sessions.id, id));
    },

    async removeAll(userId) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },

    async removeOthers(userId, keepSessionId) {
      await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
    },
  };
}

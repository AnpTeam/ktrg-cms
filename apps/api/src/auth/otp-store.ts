import { and, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { writeAudit } from "../audit/audit-store";
import { otpCodes, users } from "../db/schema";
import type { AuthUser } from "./user";
import type { OtpStore } from "./otp-service";

export function createDrizzleOtpStore(db: Db): OtpStore {
  return {
    async latest(email) {
      const [row] = await db
        .select({
          id: otpCodes.id,
          codeHash: otpCodes.codeHash,
          expiresAt: otpCodes.expiresAt,
          attempts: otpCodes.attempts,
          usedAt: otpCodes.usedAt,
        })
        .from(otpCodes)
        .where(eq(otpCodes.email, email))
        .orderBy(desc(otpCodes.expiresAt))
        .limit(1);
      return row ?? null;
    },

    async insert(row) {
      await db.insert(otpCodes).values(row);
    },

    async pruneExpired(before) {
      await db.delete(otpCodes).where(lt(otpCodes.expiresAt, before));
    },

    async consumeAttempt(id, max) {
      const rows = await db
        .update(otpCodes)
        .set({ attempts: sql`${otpCodes.attempts} + 1` })
        .where(and(eq(otpCodes.id, id), isNull(otpCodes.usedAt), lt(otpCodes.attempts, max)))
        .returning({ id: otpCodes.id });
      return rows.length === 1;
    },

    async markUsed(id, at) {
      const rows = await db
        .update(otpCodes)
        .set({ usedAt: at })
        .where(and(eq(otpCodes.id, id), isNull(otpCodes.usedAt)))
        .returning({ id: otpCodes.id });
      return rows.length === 1;
    },

    async findOrCreateUser(email, profile) {
      // The unique index is on lower(email); do nothing if the user already exists
      // (an existing account keeps its own name, origin and language).
      await db
        .insert(users)
        .values({ email, displayName: profile?.displayName, origin: profile?.origin, locale: profile?.locale })
        .onConflictDoNothing();
      const [user] = await db
        .select({ id: users.id, email: users.email, role: users.role, locale: users.locale })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (!user) throw new Error("user lookup failed after insert");
      return user satisfies AuthUser;
    },

    async promoteToAdmin(userId) {
      return db.transaction(async (tx) => {
        // Only a real change counts, so two parallel logins write one audit row, not two.
        const changed = await tx
          .update(users)
          .set({ role: "admin", updatedAt: sql`now()` })
          .where(and(eq(users.id, userId), ne(users.role, "admin")))
          .returning({ id: users.id });
        if (changed.length === 0) return false;
        // The account promoted itself by proving it owns a listed mailbox. Same transaction:
        // the role change and its audit row commit or roll back together.
        await writeAudit(tx, { actorUserId: userId, action: "user.role.bootstrap_admin", targetId: userId });
        return true;
      });
    },
  };
}

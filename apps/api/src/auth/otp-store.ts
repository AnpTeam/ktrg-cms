import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { otpCodes, users } from "../db/schema";
import type { AuthUser, OtpStore } from "./otp-service";

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

    async findOrCreateUser(email) {
      // The unique index is on lower(email); do nothing if the user already exists.
      await db.insert(users).values({ email }).onConflictDoNothing();
      const [user] = await db
        .select({ id: users.id, email: users.email, role: users.role, locale: users.locale })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (!user) throw new Error("user lookup failed after insert");
      return user satisfies AuthUser;
    },
  };
}

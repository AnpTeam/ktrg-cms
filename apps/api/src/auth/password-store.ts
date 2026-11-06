import { and, eq, gt, lt, sql } from "drizzle-orm";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { passwordUndoTokens, userPasswords, users } from "../db/schema";
import type { PasswordStore } from "./password-service";

export function createDrizzlePasswordStore(db: Db): PasswordStore {
  return {
    async findLogin(email) {
      const [row] = await db
        .select({ id: users.id, email: users.email, role: users.role, locale: users.locale, hash: userPasswords.hash })
        .from(users)
        .leftJoin(userPasswords, eq(userPasswords.userId, users.id))
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (!row) return null;
      const { hash, ...user } = row;
      return { user, hash };
    },

    async hasPassword(userId) {
      const [row] = await db.select({ userId: userPasswords.userId }).from(userPasswords).where(eq(userPasswords.userId, userId)).limit(1);
      return row !== undefined;
    },

    async save(userId, hash, undo, now) {
      return db.transaction(async (tx) => {
        const [before] = await tx.select({ userId: userPasswords.userId }).from(userPasswords).where(eq(userPasswords.userId, userId)).limit(1);
        await tx.insert(userPasswords).values({ userId, hash, updatedAt: now }).onConflictDoUpdate({ target: userPasswords.userId, set: { hash, updatedAt: now } });
        await tx.delete(passwordUndoTokens).where(lt(passwordUndoTokens.expiresAt, now));
        await tx.insert(passwordUndoTokens).values({ userId, ...undo });
        await writeAudit(tx, { actorUserId: userId, action: "password.set", targetId: userId });
        return before !== undefined;
      });
    },

    async remove(userId) {
      return db.transaction(async (tx) => {
        const gone = await tx.delete(userPasswords).where(eq(userPasswords.userId, userId)).returning({ userId: userPasswords.userId });
        if (gone.length === 0) return false;
        await writeAudit(tx, { actorUserId: userId, action: "password.remove", targetId: userId });
        return true;
      });
    },

    async undo(tokenHash, now) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select({ userId: passwordUndoTokens.userId })
          .from(passwordUndoTokens)
          .where(and(eq(passwordUndoTokens.tokenHash, tokenHash), gt(passwordUndoTokens.expiresAt, now)))
          .limit(1);
        if (!row) return null;
        await tx.delete(userPasswords).where(eq(userPasswords.userId, row.userId));
        await tx.delete(passwordUndoTokens).where(eq(passwordUndoTokens.userId, row.userId));
        await writeAudit(tx, { actorUserId: row.userId, action: "password.undo", targetId: row.userId });
        return row.userId;
      });
    },
  };
}

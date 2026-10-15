import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { passkeys, users, webauthnChallenges } from "../db/schema";
import type { PasskeyStore } from "./passkey-service";

export function createDrizzlePasskeyStore(db: Db): PasskeyStore {
  return {
    async findCredential(credentialId) {
      const [row] = await db
        .select({
          userId: passkeys.userId,
          credentialId: passkeys.credentialId,
          publicKey: passkeys.publicKey,
          counter: passkeys.counter,
        })
        .from(passkeys)
        .where(eq(passkeys.credentialId, credentialId))
        .limit(1);
      return row ?? null;
    },

    async updateCounter(credentialId, counter) {
      await db.update(passkeys).set({ counter }).where(eq(passkeys.credentialId, credentialId));
    },

    async userById(userId) {
      const [user] = await db
        .select({ id: users.id, email: users.email, role: users.role, locale: users.locale })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return user ?? null;
    },

    async credentialIds(userId) {
      const rows = await db
        .select({ credentialId: passkeys.credentialId })
        .from(passkeys)
        .where(eq(passkeys.userId, userId));
      return rows.map((r) => r.credentialId);
    },

    async saveChallenge(row) {
      await db.insert(webauthnChallenges).values(row);
    },

    async takeChallenge(challenge, type, userId, now) {
      // One atomic delete: two requests cannot both use the same challenge.
      const rows = await db
        .delete(webauthnChallenges)
        .where(
          and(
            eq(webauthnChallenges.challenge, challenge),
            eq(webauthnChallenges.type, type),
            userId === null ? isNull(webauthnChallenges.userId) : eq(webauthnChallenges.userId, userId),
            gt(webauthnChallenges.expiresAt, now),
          ),
        )
        .returning({ pendingUserId: webauthnChallenges.pendingUserId });
      return rows.length === 1 ? { pendingUserId: rows[0]!.pendingUserId } : null;
    },

    async pruneChallenges(before) {
      await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, before));
    },

    async insertPasskey({ userId, credentialId, publicKey, counter, label }) {
      const rows = await db
        .insert(passkeys)
        .values({ userId, credentialId, publicKey: Buffer.from(publicKey), counter, label })
        .onConflictDoNothing({ target: passkeys.credentialId })
        .returning({ id: passkeys.id });
      return rows.length === 1;
    },

    async createUserWithPasskey({ userId, credentialId, publicKey, counter, label }) {
      try {
        await db.transaction(async (tx) => {
          // No email: the column is null, role and locale take their defaults (participant, ja).
          await tx.insert(users).values({ id: userId });
          const rows = await tx
            .insert(passkeys)
            .values({ userId, credentialId, publicKey: Buffer.from(publicKey), counter, label })
            .onConflictDoNothing({ target: passkeys.credentialId })
            .returning({ id: passkeys.id });
          // Credential already taken: throwing rolls the new user back too.
          if (rows.length !== 1) throw new CredentialTaken();
        });
        return true;
      } catch (err) {
        if (err instanceof CredentialTaken) return false;
        throw err;
      }
    },
  };
}

class CredentialTaken extends Error {}

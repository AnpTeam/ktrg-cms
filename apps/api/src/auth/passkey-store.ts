import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { passkeys, webauthnChallenges } from "../db/schema";
import type { PasskeyStore } from "./passkey-service";

export function createDrizzlePasskeyStore(db: Db): PasskeyStore {
  return {
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
        .returning({ id: webauthnChallenges.id });
      return rows.length === 1;
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
  };
}

import { randomUUID } from "node:crypto";
import type { AuthUser } from "./user";
import type { ChallengeType, PasskeyStore } from "./passkey-service";

/** In-memory store for tests and manual checks. Mirrors the Drizzle store's rules. */
export function createMemoryPasskeyStore(
  users: Map<string, AuthUser> = new Map(),
  /** Name and origin given at sign-up, by user id. Pass the same map to the other memory stores to share it. */
  profiles: Map<string, { displayName: string | null; origin: string | null }> = new Map(),
) {
  const challenges: {
    challenge: string;
    type: ChallengeType;
    userId: string | null;
    pendingUserId: string | null;
    expiresAt: Date;
  }[] = [];
  const passkeys: {
    id: string;
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
    label: string | null;
    createdAt: Date;
  }[] = [];

  const store: PasskeyStore = {
    async list(userId) {
      return passkeys
        .filter((p) => p.userId === userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt }));
    },
    async remove(userId, passkeyId, opts) {
      const mine = passkeys.filter((p) => p.userId === userId);
      const target = mine.find((p) => p.id === passkeyId);
      if (!target) return { ok: false, reason: "not_found" };
      if (opts.keepAtLeastOne && mine.length <= 1) return { ok: false, reason: "last_method" };
      passkeys.splice(passkeys.indexOf(target), 1);
      return { ok: true, label: target.label };
    },
    async findCredential(credentialId) {
      const p = passkeys.find((x) => x.credentialId === credentialId);
      return p ? { userId: p.userId, credentialId: p.credentialId, publicKey: p.publicKey, counter: p.counter } : null;
    },
    async updateCounter(credentialId, counter) {
      const p = passkeys.find((x) => x.credentialId === credentialId);
      if (p) p.counter = counter;
    },
    async userById(userId) {
      return [...users.values()].find((u) => u.id === userId) ?? null;
    },
    async credentialIds(userId) {
      return passkeys.filter((p) => p.userId === userId).map((p) => p.credentialId);
    },
    async saveChallenge(row) {
      challenges.push(row);
    },
    async takeChallenge(challenge, type, userId, now) {
      const i = challenges.findIndex(
        (c) =>
          c.challenge === challenge && c.type === type && c.userId === userId && c.expiresAt.getTime() > now.getTime(),
      );
      if (i === -1) return null;
      const [row] = challenges.splice(i, 1);
      return { pendingUserId: row!.pendingUserId };
    },
    async pruneChallenges(before) {
      for (let i = challenges.length - 1; i >= 0; i--) {
        if (challenges[i]!.expiresAt.getTime() < before.getTime()) challenges.splice(i, 1);
      }
    },
    async insertPasskey(row) {
      if (passkeys.some((p) => p.credentialId === row.credentialId)) return null;
      const id = randomUUID();
      passkeys.push({ id, createdAt: new Date(), ...row });
      return id;
    },
    async createUserWithPasskey({ profile, ...row }) {
      if (passkeys.some((p) => p.credentialId === row.credentialId)) return false;
      users.set(row.userId, { id: row.userId, email: null, role: "participant", locale: profile.locale });
      profiles.set(row.userId, { displayName: profile.displayName, origin: profile.origin });
      passkeys.push({ id: randomUUID(), createdAt: new Date(), ...row });
      return true;
    },
  };

  return { store, challenges, passkeys, users, profiles };
}

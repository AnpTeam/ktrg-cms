import type { AuthUser } from "./otp-service";
import type { ChallengeType, PasskeyStore } from "./passkey-service";

/** In-memory store for tests and manual checks. Mirrors the Drizzle store's rules. */
export function createMemoryPasskeyStore(users: Map<string, AuthUser> = new Map()) {
  const challenges: {
    challenge: string;
    type: ChallengeType;
    userId: string | null;
    pendingUserId: string | null;
    expiresAt: Date;
  }[] = [];
  const passkeys: {
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
    label: string | null;
  }[] = [];

  const store: PasskeyStore = {
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
      if (passkeys.some((p) => p.credentialId === row.credentialId)) return false;
      passkeys.push(row);
      return true;
    },
    async createUserWithPasskey(row) {
      if (passkeys.some((p) => p.credentialId === row.credentialId)) return false;
      users.set(row.userId, { id: row.userId, email: null, role: "participant", locale: "ja" });
      passkeys.push(row);
      return true;
    },
  };

  return { store, challenges, passkeys, users };
}

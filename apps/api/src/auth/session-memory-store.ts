import type { AuthUser } from "./otp-service";
import type { SessionStore } from "./session-service";

/** In-memory store for tests and manual checks. `users` is the same map the OTP memory store fills. */
export function createMemorySessionStore(users: Map<string, AuthUser>) {
  const rows: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    absoluteExpiresAt: Date;
    lastSeenAt: Date;
  }[] = [];
  let nextId = 1;

  const store: SessionStore = {
    async create({ userId, tokenHash, expiresAt, absoluteExpiresAt, now }) {
      rows.push({ id: `s${nextId++}`, userId, tokenHash, expiresAt, absoluteExpiresAt, lastSeenAt: now });
    },
    async find(tokenHash) {
      const row = rows.find((r) => r.tokenHash === tokenHash);
      if (!row) return null;
      const user = [...users.values()].find((u) => u.id === row.userId);
      if (!user) return null;
      return { session: { id: row.id, expiresAt: row.expiresAt, absoluteExpiresAt: row.absoluteExpiresAt }, user };
    },
    async touch(id, lastSeenAt, expiresAt) {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, { lastSeenAt, expiresAt });
    },
    async remove(tokenHash) {
      const i = rows.findIndex((r) => r.tokenHash === tokenHash);
      if (i !== -1) rows.splice(i, 1);
    },
  };

  return { store, rows };
}

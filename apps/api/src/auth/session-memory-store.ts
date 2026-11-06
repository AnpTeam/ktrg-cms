import type { AuthUser } from "./user";
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
    lastLoginAt: Date;
    staffCheckedUntil: Date | null;
  }[] = [];
  let nextId = 1;

  const store: SessionStore = {
    async create({ userId, tokenHash, expiresAt, absoluteExpiresAt, now, lastLoginAt, staffCheckedUntil }) {
      rows.push({ id: `s${nextId++}`, userId, tokenHash, expiresAt, absoluteExpiresAt, lastSeenAt: now, lastLoginAt, staffCheckedUntil });
    },
    async find(tokenHash) {
      const row = rows.find((r) => r.tokenHash === tokenHash);
      if (!row) return null;
      const user = [...users.values()].find((u) => u.id === row.userId);
      if (!user) return null;
      const { id, expiresAt, absoluteExpiresAt, lastLoginAt, staffCheckedUntil } = row;
      return { session: { id, expiresAt, absoluteExpiresAt, lastLoginAt, staffCheckedUntil }, user };
    },
    async touch(id, lastSeenAt, expiresAt) {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, { lastSeenAt, expiresAt });
    },
    async remove(tokenHash) {
      const i = rows.findIndex((r) => r.tokenHash === tokenHash);
      if (i !== -1) rows.splice(i, 1);
    },
    async markFresh(id, at, staffCheckedUntil) {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      row.lastLoginAt = at;
      if (!row.staffCheckedUntil || row.staffCheckedUntil < staffCheckedUntil) row.staffCheckedUntil = staffCheckedUntil;
    },
    async keepStaffCheck(id, until) {
      const row = rows.find((r) => r.id === id);
      if (row) row.staffCheckedUntil = until;
    },
    async removeAll(userId) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.userId === userId) rows.splice(i, 1);
    },
    async removeOthers(userId, keepSessionId) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.userId === userId && rows[i]!.id !== keepSessionId) rows.splice(i, 1);
    },
  };

  return { store, rows };
}

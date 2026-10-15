import type { AuthUser, OtpRow, OtpStore } from "./otp-service";

/** In-memory store for tests and manual checks. Mirrors the Drizzle store's rules. */
export function createMemoryOtpStore() {
  const rows: (OtpRow & { email: string })[] = [];
  const users = new Map<string, AuthUser>();
  let nextId = 1;

  const store: OtpStore = {
    async latest(email) {
      const mine = rows.filter((r) => r.email === email);
      mine.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime());
      return mine[0] ?? null;
    },
    async insert(row) {
      rows.push({ id: String(nextId++), attempts: 0, usedAt: null, ...row });
    },
    async consumeAttempt(id, max) {
      const row = rows.find((r) => r.id === id);
      if (!row || row.usedAt || row.attempts >= max) return false;
      row.attempts++;
      return true;
    },
    async markUsed(id, at) {
      const row = rows.find((r) => r.id === id);
      if (!row || row.usedAt) return false;
      row.usedAt = at;
      return true;
    },
    async findOrCreateUser(email) {
      let user = users.get(email);
      if (!user) {
        user = { id: `user-${users.size + 1}`, email, role: "participant", locale: "ja" };
        users.set(email, user);
      }
      return user;
    },
  };

  return { store, rows, users };
}

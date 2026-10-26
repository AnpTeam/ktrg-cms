import { randomUUID } from "node:crypto";
import type { AuthUser } from "./user";
import type { OtpRow, OtpStore } from "./otp-service";

/** In-memory store for tests and manual checks. Mirrors the Drizzle store's rules. */
export function createMemoryOtpStore(
  /** Name and origin given at sign-up, by user id. Pass the same map to the other memory stores to share it. */
  profiles: Map<string, { displayName: string | null; origin: string | null }> = new Map(),
) {
  const rows: (OtpRow & { email: string })[] = [];
  const users = new Map<string, AuthUser>();
  /** Ids promoted by promoteToAdmin, in order: stands in for the audit log. */
  const promotions: string[] = [];
  /** Ids whose role an admin has set: stands in for their user.role.change audit rows. */
  const roleSetByAdmin = new Set<string>();
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
    async pruneExpired(before) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.expiresAt < before) rows.splice(i, 1);
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
    async findOrCreateUser(email, profile) {
      let user = users.get(email);
      if (!user) {
        user = { id: randomUUID(), email, role: "participant", locale: profile?.locale ?? "ja" };
        users.set(email, user);
        profiles.set(user.id, { displayName: profile?.displayName ?? null, origin: profile?.origin ?? null });
      }
      return user;
    },
    async setUserEmail(userId, email) {
      const mine = [...users.entries()].find(([, u]) => u.id === userId);
      if (!mine || mine[1].email || users.has(email)) return false;
      users.delete(mine[0]);
      users.set(email, { ...mine[1], email });
      return true;
    },
    async promoteToAdmin(userId) {
      const user = [...users.values()].find((u) => u.id === userId);
      if (!user || user.role === "admin" || roleSetByAdmin.has(userId)) return false;
      user.role = "admin";
      promotions.push(userId);
      return true;
    },
  };

  return { store, rows, users, promotions, roleSetByAdmin, profiles };
}

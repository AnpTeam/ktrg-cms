import type { AuthUser } from "./user";
import type { PasswordStore } from "./password-service";

/** In-memory store for tests and manual checks. `users` is the same map the OTP memory store fills. */
export function createMemoryPasswordStore(users: Map<string, AuthUser>) {
  const hashes = new Map<string, string>();
  const undos = new Map<string, { userId: string; expiresAt: Date }>();
  /** Stands in for the audit log. */
  const actions: string[] = [];

  const store: PasswordStore = {
    async findLogin(email) {
      const user = [...users.values()].find((u) => u.email?.toLowerCase() === email);
      return user ? { user, hash: hashes.get(user.id) ?? null } : null;
    },
    async hasPassword(userId) {
      return hashes.has(userId);
    },
    async save(userId, hash, undo, now) {
      for (const [key, row] of undos) if (row.expiresAt < now) undos.delete(key);
      const replaced = hashes.has(userId);
      hashes.set(userId, hash);
      undos.set(undo.tokenHash, { userId, expiresAt: undo.expiresAt });
      actions.push("password.set");
      return replaced;
    },
    async remove(userId) {
      if (!hashes.delete(userId)) return false;
      actions.push("password.remove");
      return true;
    },
    async undo(tokenHash, now) {
      const row = undos.get(tokenHash);
      if (!row || row.expiresAt <= now) return null;
      hashes.delete(row.userId);
      for (const [key, other] of undos) if (other.userId === row.userId) undos.delete(key);
      actions.push("password.undo");
      return row.userId;
    },
  };
  return { store, hashes, actions };
}

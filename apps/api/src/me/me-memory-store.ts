import { auditRow } from "../audit/audit-log";
import type { AuthUser } from "../auth/user";
import type { MeStore, Profile } from "./me-service";

type Extra = { displayName: string | null; deletionRequestedAt: Date | null; createdAt: Date };

/**
 * In-memory store for tests and the dev test page. `users` is the same map the OTP and
 * session memory stores use, so a language change is seen by the session at once.
 */
export function createMemoryMeStore(users: Map<string, AuthUser>) {
  const extras = new Map<string, Extra>();
  /** Stands in for the audit rows the Drizzle store writes in its transactions. */
  const audit: ReturnType<typeof auditRow>[] = [];

  const find = (userId: string) => [...users.values()].find((u) => u.id === userId);
  function extraOf(userId: string): Extra {
    let e = extras.get(userId);
    if (!e) extras.set(userId, (e = { displayName: null, deletionRequestedAt: null, createdAt: new Date() }));
    return e;
  }
  const profile = (user: AuthUser): Profile => ({
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    ...extraOf(user.id),
  });

  const store: MeStore = {
    async get(userId) {
      const user = find(userId);
      return user ? profile(user) : null;
    },
    async update(userId, changes) {
      const user = find(userId);
      if (!user) return null;
      if (changes.locale !== undefined) user.locale = changes.locale;
      if (changes.displayName !== undefined) extraOf(userId).displayName = changes.displayName;
      return profile(user);
    },
    async requestDeletion(userId, at) {
      const user = find(userId);
      if (!user) return null;
      const e = extraOf(userId);
      if (e.deletionRequestedAt) return { profile: profile(user), changed: false };
      e.deletionRequestedAt = at;
      audit.push(auditRow({ actorUserId: userId, action: "user.deletion_request", targetId: userId }));
      return { profile: profile(user), changed: true };
    },
    async cancelDeletion(userId) {
      const user = find(userId);
      if (!user) return null;
      const e = extraOf(userId);
      if (!e.deletionRequestedAt) return { profile: profile(user), changed: false };
      e.deletionRequestedAt = null;
      audit.push(auditRow({ actorUserId: userId, action: "user.deletion_cancel", targetId: userId }));
      return { profile: profile(user), changed: true };
    },
  };

  return { store, audit, extras };
}

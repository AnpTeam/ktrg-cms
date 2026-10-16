import { auditRow } from "../audit/audit-log";
import type { AuthUser, Origin } from "../auth/user";
import type { Preferences } from "./preferences";
import type { MeStore, Profile } from "./me-service";

type Extra = { displayName: string | null; origin: Origin | null; preferences: Preferences | null; deletionRequestedAt: Date | null; createdAt: Date };

/**
 * In-memory store for tests and the dev test page. `users` is the same map the OTP and
 * session memory stores use, so a language change is seen by the session at once.
 */
export function createMemoryMeStore(
  users: Map<string, AuthUser>,
  /** Name and origin given at sign-up (shared with the OTP and passkey memory stores). */
  profiles: Map<string, { displayName: string | null; origin: string | null }> = new Map(),
) {
  const extras = new Map<string, Extra>();
  /** Stands in for the audit rows the Drizzle store writes in its transactions. */
  const audit: ReturnType<typeof auditRow>[] = [];

  const find = (userId: string) => [...users.values()].find((u) => u.id === userId);
  function extraOf(userId: string): Extra {
    let e = extras.get(userId);
    if (!e) {
      const given = profiles.get(userId);
      e = { displayName: given?.displayName ?? null, origin: (given?.origin as Origin | null | undefined) ?? null,
        preferences: null, deletionRequestedAt: null, createdAt: new Date() };
      extras.set(userId, e);
    }
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
      if (changes.preferences !== undefined) extraOf(userId).preferences = changes.preferences;
      if (changes.origin !== undefined) extraOf(userId).origin = changes.origin;
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

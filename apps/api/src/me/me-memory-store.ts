import { auditRow } from "../audit/audit-log";
import type { AgeRange, AuthUser, Gender, Origin } from "../auth/user";
import type { Preferences } from "./preferences";
import { publicIdFor } from "../lib/public-id";
import type { MeStore, StoredProfile } from "./me-service";

type Extra = { publicId: string; displayName: string | null; origin: Origin | null; ageRange: AgeRange | null; gender: Gender | null; preferences: Preferences | null; deletionRequestedAt: Date | null; createdAt: Date };

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
  let sequence = 0;
  /** Stands in for the audit rows the Drizzle store writes in its transactions. */
  const audit: ReturnType<typeof auditRow>[] = [];

  const find = (userId: string) => [...users.values()].find((u) => u.id === userId);
  function extraOf(userId: string): Extra {
    let e = extras.get(userId);
    if (!e) {
      const given = profiles.get(userId);
      e = { publicId: publicIdFor(++sequence), displayName: given?.displayName ?? null, origin: (given?.origin as Origin | null | undefined) ?? null,
        ageRange: null, gender: null, preferences: null, deletionRequestedAt: null, createdAt: new Date() };
      extras.set(userId, e);
    }
    return e;
  }
  const profile = (user: AuthUser): StoredProfile => ({
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
      if (changes.ageRange !== undefined) extraOf(userId).ageRange = changes.ageRange;
      if (changes.gender !== undefined) extraOf(userId).gender = changes.gender;
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
    async purgeDue(cutoff) {
      let deleted = 0;
      for (const [userId, e] of [...extras]) {
        if (!e.deletionRequestedAt || e.deletionRequestedAt > cutoff) continue;
        const user = find(userId);
        if (!user) continue;
        for (const [key, u] of [...users]) if (u.id === user.id) users.delete(key);
        extras.delete(userId);
        audit.push(auditRow({ actorUserId: null, action: "user.deleted", targetId: userId }));
        deleted++;
      }
      return deleted;
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

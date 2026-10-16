import type { AuthUser, Locale, Origin, Role } from "../auth/user";
import { buildDeletionRequestEmail } from "../emails/deletion-request";
import type { Preferences } from "./preferences";
import type { Mailer } from "../lib/mailer";

export type { Locale };

/** What the account owner sees about themselves. */
export interface Profile {
  id: string;
  /** Null for an account made with a passkey alone. */
  email: string | null;
  role: Role;
  locale: Locale;
  displayName: string | null;
  /** Where they said they come from; null if they did not say. */
  origin: Origin | null;
  /** Accessibility and map choices; null until the person has set them. */
  preferences: Preferences | null;
  /** Set while a deletion request is pending; null otherwise. */
  deletionRequestedAt: Date | null;
  createdAt: Date;
}

export interface ProfileChanges {
  locale?: Locale;
  /** null clears the name. */
  displayName?: string | null;
  /** Replaces the stored choices as a whole. */
  preferences?: Preferences;
  /** Where they come from; null clears it. */
  origin?: Origin | null;
}

/** Storage the service needs; the Drizzle version is in me-store.ts. */
export interface MeStore {
  get(userId: string): Promise<Profile | null>;
  update(userId: string, changes: ProfileChanges): Promise<Profile | null>;
  /**
   * Mark a deletion request, only if none is pending, and write the audit row in the same
   * transaction. `changed` is false when one was already pending (nothing written then).
   */
  requestDeletion(userId: string, at: Date): Promise<{ profile: Profile; changed: boolean } | null>;
  /** Clear a pending request (audit row in the same transaction). `changed` false if none was pending. */
  cancelDeletion(userId: string): Promise<{ profile: Profile; changed: boolean } | null>;
}

export const DISPLAY_NAME_MAX = 40;

/**
 * Clean a typed display name: whitespace runs (including line breaks) become one space and
 * the ends are trimmed; empty means "no name". Returns undefined when it cannot be used:
 * too long, or holding control or text-direction characters that could hide or reorder
 * what other people see. Length counts characters as people see them (code points).
 */
export function normalizeDisplayName(raw: string | null): string | null | undefined {
  if (raw === null) return null;
  const name = raw.replace(/[\s\p{Zl}\p{Zp}]+/gu, " ").trim();
  if (name === "") return null;
  if (/[\p{Cc}‪-‮⁦-⁩‎‏؜]/u.test(name)) return undefined;
  if ([...name].length > DISPLAY_NAME_MAX) return undefined;
  return name;
}

export type UpdateResult = { ok: true; profile: Profile } | { ok: false; reason: "invalid_display_name" | "gone" };

export function createMeService({
  store,
  mailer,
  now = () => new Date(),
  log = console.error,
}: {
  store: MeStore;
  /** Emails the owner when a deletion is requested. Optional for tests. */
  mailer?: Mailer;
  now?: () => Date;
  log?: (message: string) => void;
}) {
  return {
    /** Null when the account no longer exists (deleted while the session lived). */
    get(user: AuthUser): Promise<Profile | null> {
      return store.get(user.id);
    },

    async update(user: AuthUser, input: ProfileChanges): Promise<UpdateResult> {
      const changes: ProfileChanges = {};
      if (input.locale !== undefined) changes.locale = input.locale;
      if (input.displayName !== undefined) {
        const name = normalizeDisplayName(input.displayName);
        if (name === undefined) return { ok: false, reason: "invalid_display_name" };
        changes.displayName = name;
      }
      if (input.preferences !== undefined) changes.preferences = input.preferences;
      if (input.origin !== undefined) changes.origin = input.origin;
      const profile = await store.update(user.id, changes);
      return profile ? { ok: true, profile } : { ok: false, reason: "gone" };
    },

    /**
     * Ask for the account to be deleted. Nothing is deleted here: the request is recorded
     * (and audited) and the owner is emailed, so they can cancel if it was not them.
     * Asking again while one is pending changes nothing and sends nothing.
     */
    async requestDeletion(user: AuthUser): Promise<Profile | null> {
      const at = now();
      const result = await store.requestDeletion(user.id, at);
      if (!result) return null;
      if (result.changed && result.profile.email && mailer) {
        try {
          await mailer.send(buildDeletionRequestEmail({ to: result.profile.email, locale: result.profile.locale, at }));
        } catch (err) {
          // The request still stands; the email is a courtesy, not the record.
          log(`[me] deletion email failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return result.profile;
    },

    async cancelDeletion(user: AuthUser): Promise<Profile | null> {
      return (await store.cancelDeletion(user.id))?.profile ?? null;
    },
  };
}

export type MeService = ReturnType<typeof createMeService>;

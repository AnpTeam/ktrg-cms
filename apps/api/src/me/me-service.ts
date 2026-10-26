import type { AgeRange, AuthUser, FoundVia, Gender, Locale, Origin, Role } from "../auth/user";
import { buildDeletionRequestEmail } from "../emails/deletion-request";
import type { Preferences } from "./preferences";
import type { Mailer } from "../lib/mailer";

export type { Locale };

/** How long a deletion request can be cancelled before the account and its data are really deleted. */
export const DELETION_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the account owner sees about themselves. */
export interface Profile {
  id: string;
  /** The unique 8-digit ID shown on the profile, to quote to support (see lib/public-id.ts). */
  publicId: string;
  /** Null for an account made with a passkey alone. */
  email: string | null;
  role: Role;
  locale: Locale;
  displayName: string | null;
  /** Where they said they come from; null if they did not say. */
  origin: Origin | null;
  /** Age band and gender they chose after registering; null until answered. */
  ageRange: AgeRange | null;
  gender: Gender | null;
  /** How they found the rally; null until answered. */
  foundVia: FoundVia | null;
  /** Accessibility and map choices; null until the person has set them. */
  preferences: Preferences | null;
  /** Route ids they bookmarked, newest first. */
  bookmarks: string[];
  /** Set while a deletion request is pending; null otherwise. */
  deletionRequestedAt: Date | null;
  /** When the account will really be deleted (the request plus the grace period); null with no request. */
  deletionDueAt: Date | null;
  createdAt: Date;
}

/** A profile as the store holds it: the due date is worked out by the service. */
export type StoredProfile = Omit<Profile, "deletionDueAt">;

export interface ProfileChanges {
  locale?: Locale;
  /** null clears the name. */
  displayName?: string | null;
  /** Replaces the stored choices as a whole. */
  preferences?: Preferences;
  /** Replaces the bookmarks as a whole. */
  bookmarks?: string[];
  /** Where they come from; null clears it. */
  origin?: Origin | null;
  /** Null clears it. */
  ageRange?: AgeRange | null;
  gender?: Gender | null;
  foundVia?: FoundVia | null;
}

/** Storage the service needs; the Drizzle version is in me-store.ts. */
export interface MeStore {
  get(userId: string): Promise<StoredProfile | null>;
  update(userId: string, changes: ProfileChanges): Promise<StoredProfile | null>;
  /**
   * Mark a deletion request, only if none is pending, and write the audit row in the same
   * transaction. `changed` is false when one was already pending (nothing written then).
   */
  requestDeletion(userId: string, at: Date): Promise<{ profile: StoredProfile; changed: boolean } | null>;
  /** Clear a pending request (audit row in the same transaction). `changed` false if none was pending. */
  cancelDeletion(userId: string): Promise<{ profile: StoredProfile; changed: boolean } | null>;
  /**
   * Delete every account whose deletion was requested at or before `cutoff` (cascades to sessions, passkeys and
   * stamps), writing an audit row for each in the same transaction. Returns how many were deleted.
   */
  purgeDue(cutoff: Date): Promise<number>;
}

/** Add the day the deletion will happen. */
export function present(profile: StoredProfile): Profile {
  return {
    ...profile,
    deletionDueAt: profile.deletionRequestedAt ? new Date(profile.deletionRequestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS) : null,
  };
}

export const DISPLAY_NAME_MAX = 40;
export const BOOKMARKS_MAX = 100;

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
    async get(user: AuthUser): Promise<Profile | null> {
      const stored = await store.get(user.id);
      return stored ? present(stored) : null;
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
      if (input.bookmarks !== undefined) changes.bookmarks = [...new Set(input.bookmarks)].slice(0, BOOKMARKS_MAX);
      if (input.origin !== undefined) changes.origin = input.origin;
      if (input.ageRange !== undefined) changes.ageRange = input.ageRange;
      if (input.gender !== undefined) changes.gender = input.gender;
      if (input.foundVia !== undefined) changes.foundVia = input.foundVia;
      const profile = await store.update(user.id, changes);
      return profile ? { ok: true, profile: present(profile) } : { ok: false, reason: "gone" };
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
          await mailer.send(buildDeletionRequestEmail({ to: result.profile.email, locale: result.profile.locale, at, deleteOn: new Date(at.getTime() + DELETION_GRACE_DAYS * DAY_MS) }));
        } catch (err) {
          // The request still stands; the email is a courtesy, not the record.
          log(`[me] deletion email failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return present(result.profile);
    },

    async cancelDeletion(user: AuthUser): Promise<Profile | null> {
      const result = await store.cancelDeletion(user.id);
      return result ? present(result.profile) : null;
    },

    /** Delete the accounts whose grace period is over. Called hourly by the purge-deletions workflow (POST /internal/purge-deletions). */
    purgeDue(): Promise<number> {
      return store.purgeDue(new Date(now().getTime() - DELETION_GRACE_DAYS * DAY_MS));
    },
  };
}

export type MeService = ReturnType<typeof createMeService>;

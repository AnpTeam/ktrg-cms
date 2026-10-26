import { errorKeyFromApi, type ErrorKey } from "./api-error";
// Pure helpers for the login and register screens (no browser APIs here, so they are unit-tested).

/** The sign-up choices for "where do you come from"; the keys match the API's `user_origin`. */
export const origins = ["osaka", "wakayama", "nara", "other_japan", "overseas"] as const;
export type Origin = (typeof origins)[number];

/** The age bands asked after registering; the keys match the API's `user_age_range`. */
export const ageRanges = ["under20", "20s", "30s", "40s", "50s", "60s", "70plus"] as const;
export type AgeRange = (typeof ageRanges)[number];

/** The gender answers; "unspecified" ("I'd rather not say") is an answer, so the visitor can stay anonymous. Keys match `user_gender`. */
export const genders = ["female", "male", "other", "unspecified"] as const;
export type Gender = (typeof genders)[number];

/** How they found the rally, asked after registering; the keys match the API's `user_found_via`. */
export const foundVias = ["qr_or_sign", "flyer", "tourism_site", "sns", "search", "friend", "other"] as const;
export type FoundVia = (typeof foundVias)[number];

/**
 * The ID shown on the profile, in two groups of four (0004-8271). It is the account's unique 8-digit public ID
 * (see the API's lib/public-id.ts): support can go straight to the account with it. It is not a secret and
 * grants nothing.
 */
export function formatPublicId(publicId: string): string {
  return /^\d{8}$/.test(publicId) ? `${publicId.slice(0, 4)}-${publicId.slice(4)}` : publicId;
}

/** Longest display name the API accepts (apps/api DISPLAY_NAME_MAX). */
export const NAME_MAX = 40;

/**
 * Why a sign-in step failed: the shared error names (lib/api-error.ts), which the screens translate through
 * `useErrorMessages`. Kept under its old name because the sign-in code speaks of "failures".
 */
export type AuthFailure = ErrorKey;

/** Turn an API failure (HTTP status plus the `{ ok: false, error }` body) into an AuthFailure. */
export function failureFromApi(status: number, value: unknown): AuthFailure {
  return errorKeyFromApi(status, value);
}

/**
 * Where to go after signing in. Only a path on this site is allowed (starts with one slash and
 * is not protocol-relative), so a crafted link cannot send the visitor to another site.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** True when the name has something to save: not empty after the same whitespace clean-up as the API. */
export function hasName(raw: string): boolean {
  return raw.replace(/\s+/gu, " ").trim().length > 0;
}

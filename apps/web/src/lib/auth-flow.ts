// Pure helpers for the login and register screens (no browser APIs here, so they are unit-tested).

/** The sign-up choices for "where do you come from"; the keys match the API's `user_origin`. */
export const origins = ["osaka", "wakayama", "nara", "other_japan", "overseas"] as const;
export type Origin = (typeof origins)[number];

/** Longest display name the API accepts (apps/api DISPLAY_NAME_MAX). */
export const NAME_MAX = 40;

/**
 * Why a sign-in step failed, in words the screens can translate. The API sends error codes,
 * never display text; the rest come from the browser's passkey prompt.
 */
export type AuthFailure =
  | "unsupported"
  | "cancelled"
  | "invalid_display_name"
  | "invalid_code"
  | "login_failed"
  | "registration_failed"
  | "too_many_requests"
  | "network"
  | "failed";

const apiCodes: readonly string[] = ["invalid_display_name", "invalid_code", "login_failed", "registration_failed"];

/** Turn an API failure (HTTP status plus the `{ ok: false, error }` body) into an AuthFailure. */
export function failureFromApi(status: number, value: unknown): AuthFailure {
  if (status === 429) return "too_many_requests";
  const code = (value as { error?: unknown } | null)?.error;
  return typeof code === "string" && apiCodes.includes(code) ? (code as AuthFailure) : "failed";
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

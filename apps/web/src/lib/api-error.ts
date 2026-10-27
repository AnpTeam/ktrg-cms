import type { ErrorCode } from "@ktrg/api"; // type only: nothing from the API is bundled

// What went wrong, as a short name the screens can translate (WBS 3.3.4). The API sends error codes, never display
// text; a few more come from the phone itself (no signal, the passkey prompt). Every screen shows the same
// sentence for the same name (see components/useErrorMessages.ts).

/** Failures that never come from the server. */
export type ClientErrorKey = "network" | "unsupported" | "cancelled" | "failed";

export type ErrorKey = ErrorCode | ClientErrorKey;

/**
 * Every code the API can send. Written as a Record over the API's own `ErrorCode` type, so the compiler stops
 * the build when the API gains a code that is not listed here (and then not translated either).
 */
const SERVER_CODES: Record<ErrorCode, true> = {
  bad_request: true,
  validation_failed: true,
  not_found: true,
  rate_limited: true,
  internal_error: true,
  unauthenticated: true,
  forbidden: true,
  reauth_required: true,
  invalid_code: true,
  no_email: true,
  no_passkey: true,
  reauth_failed: true,
  login_failed: true,
  registration_failed: true,
  too_many_passkeys: true,
  last_login_method: true,
  email_in_use: true,
  invalid_display_name: true,
  conflict: true,
  invalid_video_url: true,
  invalid_line: true,
  invalid_photo_url: true,
  route_has_places: true,
  spot_has_stamps: true,
  no_coordinates: true,
  position_not_verified: true,
  source_required: true,
  permission_required: true,
  invalid_source_url: true,
  cannot_change_own_role: true,
  account_restricted: true,
  cannot_manage_self: true,
  cannot_manage_admin: true,
  spot_closed: true,
  too_far: true,
  gps_accuracy_poor: true,
  guest_full: true,
  stamp_revoked: true,
  rally_empty: true,
  invalid_rally_members: true,
  invalid_file: true,
  uploads_unavailable: true,
  routing_unavailable: true,
  routing_no_route: true,
  routing_failed: true,
};

export const isServerCode = (value: unknown): value is ErrorCode => typeof value === "string" && Object.hasOwn(SERVER_CODES, value);

/**
 * Turn an API failure (the HTTP status plus the `{ ok: false, error }` body) into an ErrorKey. The code in the
 * body wins; with no usable code the status decides, and anything else is a plain "failed".
 */
export function errorKeyFromApi(status: number, body: unknown): ErrorKey {
  const code = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  if (isServerCode(code)) return code;
  if (status === 413) return "invalid_file"; // the host refused a body that is too big
  if (status === 429) return "rate_limited";
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "internal_error";
  return "failed";
}

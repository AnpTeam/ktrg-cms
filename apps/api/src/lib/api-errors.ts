import { Elysia, ValidationError } from "elysia";

/**
 * THE error codes: every `error` an API answer can carry, in one place.
 *
 * Every failure is `{ ok: false, error: <code> }` with an HTTP status; validation failures add
 * `issues`. `fail()` only accepts codes listed here, so a new code starts in this table. The
 * text is what the code means, for people reading the docs.
 */
export const ERROR_CODES = {
  // --- Any route -------------------------------------------------------------------------
  bad_request: "400: the body could not be read (not valid JSON, for example)",
  validation_failed: "422: the body, URL or query is not in the expected shape; see `issues`",
  not_found: "404: no such route, or no such thing (someone else's looks the same)",
  rate_limited: "429: too many tries; wait for the `Retry-After` seconds",
  internal_error: "500: our fault; quote the `x-request-id` header when reporting it",

  // --- Login and permissions -------------------------------------------------------------
  unauthenticated: "401: not logged in, or the session ended",
  forbidden: "403: logged in, but not allowed",
  reauth_required: "403: allowed, but needs a fresh login first (a passkey check at /auth/passkeys/reauth, or POST /auth/reauth/request + verify)",
  invalid_login: "401: wrong email or password; the same for an account with no password",
  password_too_short: "400: a password needs at least 8 characters",
  password_too_common: "400: this password is too easy to guess",
  invalid_undo_link: "400: the link in the password email was used already, or is too old",
  invalid_code: "401 at login, 400 at the fresh-login re-check: wrong, expired, used or locked code",
  no_email: "409: this account has no email to send a code to",
  no_passkey: "409: this account has no passkey to confirm with (use the emailed code)",
  reauth_failed: "400: the passkey check for a fresh login did not pass",

  // --- Passkeys --------------------------------------------------------------------------
  login_failed: "401: passkey login failed",
  registration_failed: "400: the passkey could not be added or created",
  too_many_passkeys: "409: the account already has the most passkeys allowed",
  last_login_method: "409: cannot remove the only way to log in",

  email_in_use: "409: this account already has an email, or the address belongs to another account",

  // --- Profile ---------------------------------------------------------------------------
  invalid_display_name: "400: too long, or contains hidden characters",

  // --- Admin content (routes and places) ---------------------------------------------------
  conflict: "409: someone saved this first; reload it and try again",
  invalid_video_url: "400: only https links on YouTube or Vimeo are accepted",
  invalid_line: "400: the route line is not a line inside Japan with 2 to 50,000 points",
  invalid_photo_url: "400: a photo address must be a link that starts with https://",
  route_has_places: "409: a route that still has places cannot be deleted",
  spot_has_stamps: "409: a place with stamps that are not revoked cannot be deleted; revoke them or unpublish it",
  no_coordinates: "409: the place has no position yet",
  position_not_verified: "409: the position has not been checked against an official source",
  source_required: "400: name the source when the position is marked as checked",
  permission_required: "409: the site's permission is not confirmed",

  // --- Stamping (GPS check-in) --------------------------------------------------------------
  spot_closed: "409: the place is closed, so no stamp can be collected there",
  too_far: "409: the phone is not close enough to the place",
  stamp_revoked: "409: an admin revoked the stamp this account held at the place, so a new one cannot be collected",
  stale_scan: "422: a stamp pressed offline is too old (more than 48 hours) to be accepted",
  bad_time: "422: the time the stamp was pressed is not a valid time, or is in the future",
  gps_accuracy_poor: "422: the GPS reading is too rough (worse than 100 m); move to open sky and try again",
  guest_full: "409: a visitor without an account holds the most stamps that can be kept this way; sign up to keep collecting",

  // --- Admin rallies ---------------------------------------------------------------------
  rally_empty: "409: a rally with nothing in it cannot be published, and a published rally cannot be emptied",
  invalid_rally_members: "400: a rally of places takes stamp places, a rally of courses takes courses, each once",

  // --- Admin lists (trail notices, ...) ---------------------------------------------------
  invalid_source_url: "400: the source must be a link that starts with https://",
  account_restricted: "403: an admin restricted this account: it can look but cannot take part (collect stamps, write comments)",
  cannot_manage_self: "409: an admin cannot restrict or delete their own account",
  cannot_manage_admin: "409: an admin account cannot be restricted or deleted; change its role first",
  cannot_change_own_role: "409: an admin cannot change their own role (so the last admin cannot lock everyone out)",

  // --- Uploads ---------------------------------------------------------------------------
  invalid_file: "400: only a JPEG, PNG or WebP image of at most 4 MB",
  uploads_unavailable: "503: photo storage is not set up here, or did not answer; try again later",

  // --- Snapping a drawn line to trails (admin) ---------------------------------------------
  routing_unavailable: "503: the route-finding service is not set up, its key was refused, or its daily allowance is used up",
  routing_no_route: "422: no walkable path was found near the points (or between them)",
  routing_failed: "502: the route-finding service did not answer properly; try again",
} as const satisfies Record<string, string>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** One problem with the request. `path` is a JSON pointer into `in` ("/email"); values are never echoed. */
export interface ValidationIssue {
  in: string;
  path: string;
  message: string;
}

export interface ApiError {
  ok: false;
  error: ErrorCode;
  issues?: ValidationIssue[];
}

export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_ISSUES = 10;

/**
 * The id for this request: the caller's (a proxy, or the web app) when it looks like an id,
 * otherwise a new UUID. Anything else is dropped, so a log line cannot be forged through it.
 */
export function requestIdFrom(incoming: string | null): string {
  return incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}

/**
 * The base every API route sits on. Mount it first:
 *
 * - Every response carries `x-request-id`. It is a header, not part of the body: some answers
 *   must be byte-identical whoever asks (login, "not found"), so they cannot hold a unique id.
 * - Errors the routes do not answer themselves get the same `{ ok: false, error }` shape:
 *   unreadable body 400 `bad_request`, schema mismatch 422 `validation_failed` (+ `issues`),
 *   unknown route 404 `not_found`, anything thrown 500 `internal_error`.
 * - A 500 tells the caller nothing; the server log gets the request id, method, path (no query
 *   string, which could carry a token) and the error. Never put personal data in error messages.
 * - CSRF: with `allowedOrigin`, a request that changes data and carries a foreign `Origin` header
 *   gets 403 `forbidden` before any route runs. No `Origin` passes (the scheduled purge, curl);
 *   browsers always send it on such requests.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function apiBase(opts: { log?: (line: string) => void; allowedOrigin?: () => string } = {}) {
  const log = opts.log ?? console.error;
  // Each refused origin is logged once (up to a few), so a site served from a second address (www, a preview URL) is easy to spot.
  const refusedOrigins = new Set<string>();

  return new Elysia({ name: "api-base" })
    .onRequest(({ request, set, status }) => {
      set.headers[REQUEST_ID_HEADER] = requestIdFrom(request.headers.get(REQUEST_ID_HEADER));
      set.headers["x-content-type-options"] = "nosniff"; // the API answers JSON only; never let a browser guess otherwise
      const origin = request.headers.get("origin");
      if (opts.allowedOrigin && origin && !SAFE_METHODS.has(request.method) && origin !== opts.allowedOrigin()) {
        if (refusedOrigins.size < 20 && !refusedOrigins.has(origin)) {
          refusedOrigins.add(origin);
          log(`[api] refused a write from origin ${origin.slice(0, 200)}; the allowed origin is ${opts.allowedOrigin()} (set APP_ORIGIN to the address people use)`);
        }
        return status(403, { ok: false, error: "forbidden" } satisfies ApiError);
      }
    })
    .onError({ as: "global" }, ({ code, error, set, request, status }) => {
      // status(), not a bare object: the answer is filed under its status code, so the typed client
      // (Eden) sees it as an error. A bare object would be added to every route's success type.
      const answer = <const S extends 400 | 404 | 422 | 500>(code: S, body: ApiError) => status(code, body);

      // A response that breaks its own schema is our bug, not the caller's.
      if (code === "VALIDATION" && error instanceof ValidationError && error.type !== "response") {
        return answer(422, { ok: false, error: "validation_failed", issues: issuesOf(error) });
      }
      if (code === "PARSE" || code === "INVALID_COOKIE_SIGNATURE" || code === "INVALID_FILE_TYPE") {
        return answer(400, { ok: false, error: "bad_request" });
      }
      if (code === "NOT_FOUND") return answer(404, { ok: false, error: "not_found" });

      const requestId = String(set.headers[REQUEST_ID_HEADER] ?? "-");
      log(`[api] 500 ${requestId} ${request.method} ${new URL(request.url).pathname}: ${describe(error)}`);
      return answer(500, { ok: false, error: "internal_error" });
    });
}

/** Where and what, never the submitted value (it may be an email or a code). */
function issuesOf(error: ValidationError): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const e of error.all) {
    const issue = { in: error.type, path: e.path || "/", message: e.message };
    const key = `${issue.path}\n${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
    if (issues.length === MAX_ISSUES) break;
  }
  return issues;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

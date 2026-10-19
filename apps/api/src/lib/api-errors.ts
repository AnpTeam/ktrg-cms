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
  invalid_code: "401 at login, 400 at the fresh-login re-check: wrong, expired, used or locked code",
  no_email: "409: this account has no email to send a code to",
  no_passkey: "409: this account has no passkey to confirm with (use the emailed code)",
  reauth_failed: "400: the passkey check for a fresh login did not pass",

  // --- Passkeys --------------------------------------------------------------------------
  login_failed: "401: passkey login failed",
  registration_failed: "400: the passkey could not be added or created",
  too_many_passkeys: "409: the account already has the most passkeys allowed",
  last_login_method: "409: cannot remove the only way to log in",

  // --- Profile ---------------------------------------------------------------------------
  invalid_display_name: "400: too long, or contains hidden characters",

  // --- Admin content (routes and places) ---------------------------------------------------
  conflict: "409: someone saved this first; reload it and try again",
  invalid_video_url: "400: only https links on YouTube or Vimeo are accepted",
  invalid_line: "400: the route line is not a line inside Japan with 2 to 50,000 points",
  invalid_photo_url: "400: a photo address must be a link that starts with https://",
  route_has_places: "409: a route that still has places cannot be deleted",
  spot_has_stamps: "409: a place that visitors have stamped cannot be deleted; unpublish it instead",
  no_coordinates: "409: the place has no position yet",
  position_not_verified: "409: the position has not been checked against an official source",
  source_required: "400: name the source when the position is marked as checked",
  permission_required: "409: the site's permission is not confirmed",
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
 */
export function apiBase(opts: { log?: (line: string) => void } = {}) {
  const log = opts.log ?? console.error;

  return new Elysia({ name: "api-base" })
    .onRequest(({ request, set }) => {
      set.headers[REQUEST_ID_HEADER] = requestIdFrom(request.headers.get(REQUEST_ID_HEADER));
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

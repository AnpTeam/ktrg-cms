import { clientIp } from "../lib/client-ip";
import type { RateLimitResult } from "./rate-limit";
import type { AuthUser } from "./otp-service";
import {
  clearSessionCookie,
  readCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session";
import type { Authenticated, SessionService } from "./session-service";

type Headers = Record<string, string | undefined>;
export type SetLike = { status?: number | string; headers: Record<string, string | number> };
type Ctx = { headers: Headers; request: Request; server: unknown };

/**
 * Small helpers shared by the auth route files: client IP, the 429 answer, and
 * reading the session cookie. `secureCookies` is true in production (HTTPS);
 * `trustProxy` says whether X-Forwarded-For can be believed.
 */
export function createHttpHelpers(opts: {
  secureCookies: boolean;
  trustProxy: boolean;
  getSession: () => SessionService;
}) {
  const cookieName = sessionCookieName(opts.secureCookies);

  const cookieFor = (token: string, expiresAt: Date) =>
    serializeSessionCookie({
      name: cookieName,
      value: token,
      maxAgeSec: (expiresAt.getTime() - Date.now()) / 1000,
      secure: opts.secureCookies,
    });

  /** The session behind the request's cookie, re-issuing the cookie if the expiry slid. */
  async function session(headers: Headers, set: SetLike): Promise<Authenticated | null> {
    const token = readCookie(headers.cookie, cookieName);
    const auth = token ? await opts.getSession().authenticate(token) : null;
    if (!auth || !token) return null;
    if (auth.refreshed) set.headers["set-cookie"] = cookieFor(token, auth.expiresAt);
    return auth;
  }

  return {
    cookieName,
    cookieFor,
    clearCookie: () => clearSessionCookie(cookieName, opts.secureCookies),
    tokenFrom: (headers: Headers) => readCookie(headers.cookie, cookieName),

    ipOf: ({ headers, request, server }: Ctx) =>
      clientIp({
        headers,
        requestIp: (server as { requestIP?: (r: Request) => { address: string } | null } | null)?.requestIP?.(
          request,
        )?.address,
        trustProxy: opts.trustProxy,
      }),

    /** Sets a 429 with Retry-After and returns the body, or returns null when allowed. */
    tooMany(set: SetLike, r: RateLimitResult) {
      if (r.allowed) return null;
      set.status = 429;
      set.headers["retry-after"] = String(r.retryAfterSec);
      return { ok: false as const, error: "rate_limited" as const };
    },

    session,

    /** The user behind the request's session cookie, re-issuing the cookie if the expiry slid. */
    async authenticate(headers: Headers, set: SetLike): Promise<AuthUser | null> {
      return (await session(headers, set))?.user ?? null;
    },
  };
}

export type HttpHelpers = ReturnType<typeof createHttpHelpers>;

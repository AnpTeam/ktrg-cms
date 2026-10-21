import { Elysia } from "elysia";
import type { AuditWriter } from "../audit/audit-log";
import { auditTrail } from "../audit/audit-trail";
import { authGuards } from "./guards";
import { createHttpHelpers, type HttpHelpers } from "./http";
import { normalizeEmail } from "./otp";
import { AUTH_LIMITS, type RateLimiter } from "./rate-limit";
import type { SessionService } from "./session-service";

/** How every route file is set up: true in production (HTTPS cookies); whether X-Forwarded-For is believed. */
export interface RouteOptions {
  secureCookies: boolean;
  trustProxy?: boolean;
}

/** The services the shared route options (auth, audit, rateLimit) need. */
export interface KitServices {
  session: SessionService;
  rateLimit: RateLimiter;
  audit: AuditWriter;
}

/**
 * Where a rate-limit identifier comes from:
 * - "ip"          the client IP (X-Forwarded-For only behind a trusted proxy)
 * - "user.id"     the logged-in user (needs `auth` on the route)
 * - "user.email"  the logged-in user's email (needs `auth`)
 * - "body.email"  the `email` field of the request body, normalized
 */
export type LimitKey = "ip" | "user.id" | "user.email" | "body.email";

/** `{ rateLimit: { otpVerifyEmail: "body.email", otpVerifyIp: "ip" } }`: which AUTH_LIMITS rule counts what. */
export type RateLimitSpec = Partial<Record<keyof typeof AUTH_LIMITS, LimitKey>>;

type LimitContext = {
  user?: { id: string; email: string | null };
  body?: unknown;
  headers: Record<string, string | undefined>;
  request: Request;
  server: unknown;
  set: Parameters<HttpHelpers["tooMany"]>[0];
};

function identifier(key: LimitKey, ctx: LimitContext, http: HttpHelpers): string | null {
  switch (key) {
    case "ip":
      return http.ipOf(ctx);
    case "user.id":
      return ctx.user?.id ?? null;
    case "user.email":
      return ctx.user?.email ?? null;
    case "body.email": {
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      return typeof email === "string" ? normalizeEmail(email) : null;
    }
  }
}

/**
 * The shared setup of a route file: the HTTP helpers and one plugin that adds three route
 * options, so a route says what it needs instead of repeating the code:
 *
 *   .post("/x", handler, {
 *     auth: "me.manage",                                      // login + permission (guards.ts)
 *     rateLimit: { meDeletionUser: "user.id" },               // 429 + Retry-After when over
 *     audit: "user.deletion_request",                         // record it on success (audit-trail.ts)
 *   })
 *
 * Rate limits run after validation and after `auth`, before the handler. Every listed rule
 * counts the hit (so none is skipped) and the longest wait is reported. When an identifier
 * is missing (a passkey-only account has no email) only that rule is skipped; the others still count.
 */
export function routeKit<S extends KitServices>(getServices: () => S, opts: RouteOptions) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: opts.trustProxy ?? false,
    getSession: () => getServices().session,
  });

  // Not named: a named plugin is shared between route files, closures and all.
  const rateLimits = new Elysia().macro({
    rateLimit: (spec: RateLimitSpec) => ({
      // Name every field this reads in the parameters: Elysia only prepares (parses) the parts
      // of the request a hook visibly uses, so reading `headers` through a cast would see none.
      beforeHandle: async ({ headers, request, server, body, set, status, ...rest }) => {
        const user = (rest as { user?: LimitContext["user"] }).user;
        const c: LimitContext = { headers, request, server, body, set, user };
        const hits: { rule: (typeof AUTH_LIMITS)[keyof typeof AUTH_LIMITS]; identifier: string }[] = [];
        for (const [rule, key] of Object.entries(spec) as [keyof typeof AUTH_LIMITS, LimitKey][]) {
          const id = identifier(key, c, http);
          if (id !== null) hits.push({ rule: AUTH_LIMITS[rule], identifier: id }); // a missing one skips only its own rule
        }
        if (hits.length === 0) return;
        const limited = http.tooMany(c.set, await getServices().rateLimit.checkAll(hits));
        // status(), not the bare body: a bare body would join the route's success type.
        if (limited) return status(429, limited);
      },
    }),
  });

  const plugins = new Elysia()
    .use(authGuards({ getSession: () => getServices().session, secureCookies: opts.secureCookies }))
    .use(auditTrail({ getAudit: () => getServices().audit }))
    .use(rateLimits);

  return { http, plugins };
}

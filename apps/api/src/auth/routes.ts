import { Elysia, t } from "elysia";
import type { AuditWriter } from "../audit/audit-log";
import { auditTrail } from "../audit/audit-trail";
import { authGuards } from "./guards";
import { createHttpHelpers } from "./http";
import { normalizeEmail } from "./otp";
import type { OtpService } from "./otp-service";
import { AUTH_LIMITS, type RateLimiter } from "./rate-limit";
import type { SessionService } from "./session-service";

const email = t.String({ format: "email", maxLength: 254 });

export interface AuthServices {
  otp: OtpService;
  session: SessionService;
  rateLimit: RateLimiter;
  audit: AuditWriter;
}

/**
 * Auth endpoints. Services are resolved per request so importing this stays
 * side-effect free. `secureCookies` is true in production (HTTPS); `trustProxy`
 * says whether X-Forwarded-For can be believed for the rate limits.
 */
export function authRoutes(
  getServices: () => AuthServices,
  opts: { secureCookies: boolean; trustProxy?: boolean },
) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: opts.trustProxy ?? false,
    getSession: () => getServices().session,
  });

  return new Elysia({ prefix: "/auth" })
    .use(authGuards({ getSession: () => getServices().session, secureCookies: opts.secureCookies }))
    .use(auditTrail({ getAudit: () => getServices().audit }))
    .post(
      "/otp/request",
      async ({ body, set, ...ctx }) => {
        const { otp, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([
            { rule: AUTH_LIMITS.otpRequestEmail, identifier: normalizeEmail(body.email) },
            { rule: AUTH_LIMITS.otpRequestIp, identifier: http.ipOf(ctx) },
          ]),
        );
        if (limited) return limited;

        await otp.request(body.email, body.locale);
        // Same answer whether a code was sent, throttled or the mail failed.
        return { ok: true as const };
      },
      { body: t.Object({ email, locale: t.Optional(t.Union([t.Literal("ja"), t.Literal("en")])) }) },
    )
    .post(
      "/otp/verify",
      async ({ body, set, ...ctx }) => {
        const { otp, session, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([
            { rule: AUTH_LIMITS.otpVerifyEmail, identifier: normalizeEmail(body.email) },
            { rule: AUTH_LIMITS.otpVerifyIp, identifier: http.ipOf(ctx) },
          ]),
        );
        if (limited) return limited;

        const result = await otp.verify(body.email, body.code);
        if (!result.ok) {
          // One answer for wrong, expired, used, locked or unknown.
          set.status = 401;
          return { ok: false as const, error: "invalid_code" as const };
        }
        const { token, expiresAt } = await session.create(result.user);
        set.headers["set-cookie"] = http.cookieFor(token, expiresAt);
        return { ok: true as const, user: result.user };
      },
      { body: t.Object({ email, code: t.String({ pattern: "^[0-9]{6}$" }) }) },
    )
    // Minimal "who am I": the full /me API is WBS 2.1.14.
    .get("/session", async ({ headers, set }) => {
      const user = await http.authenticate(headers, set);
      if (!user) {
        set.status = 401;
        return { ok: false as const, error: "unauthenticated" as const };
      }
      return { ok: true as const, user };
    })
    // Fresh login, step 1: email a code to the logged-in account. Needed before a permission
    // marked FRESH_LOGIN_REQUIRED (the guard answers 403 reauth_required until then).
    .post(
      "/reauth/request",
      async ({ user, set, ...ctx }) => {
        // A passkey-only account has no mailbox to prove (a passkey re-check is not built yet).
        if (!user.email) {
          set.status = 409;
          return { ok: false as const, error: "no_email" as const };
        }
        const { otp, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([
            { rule: AUTH_LIMITS.otpRequestEmail, identifier: user.email },
            { rule: AUTH_LIMITS.otpRequestIp, identifier: http.ipOf(ctx) },
          ]),
        );
        if (limited) return limited;

        await otp.request(user.email, user.locale, "reauth");
        // Same answer whether a code was sent or held back by the 60 s cooldown.
        return { ok: true as const };
      },
      { auth: "me.manage" },
    )
    // Fresh login, step 2: the right code makes this session fresh for FRESH_LOGIN_MS.
    .post(
      "/reauth/verify",
      async ({ user, authSession, body, set, ...ctx }) => {
        if (!user.email) {
          set.status = 409;
          return { ok: false as const, error: "no_email" as const };
        }
        const { otp, session, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([
            { rule: AUTH_LIMITS.otpVerifyEmail, identifier: user.email },
            { rule: AUTH_LIMITS.otpVerifyIp, identifier: http.ipOf(ctx) },
          ]),
        );
        if (limited) return limited;

        if (!(await otp.checkCode(user.email, body.code))) {
          // 400, not 401: the session itself is still fine.
          set.status = 400;
          return { ok: false as const, error: "invalid_code" as const };
        }
        const freshUntil = await session.markFresh(authSession.id);
        return { ok: true as const, freshUntil: freshUntil.toISOString() };
      },
      {
        auth: "me.manage",
        audit: { action: "session.reauth", target: "self" },
        body: t.Object({ code: t.String({ pattern: "^[0-9]{6}$" }) }),
      },
    )
    .post("/logout", async ({ headers, set }) => {
      const token = http.tokenFrom(headers);
      if (token) await getServices().session.destroy(token);
      set.headers["set-cookie"] = http.clearCookie();
      return { ok: true as const };
    });
}

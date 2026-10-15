import { Elysia, t } from "elysia";
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
    .post("/logout", async ({ headers, set }) => {
      const token = http.tokenFrom(headers);
      if (token) await getServices().session.destroy(token);
      set.headers["set-cookie"] = http.clearCookie();
      return { ok: true as const };
    });
}

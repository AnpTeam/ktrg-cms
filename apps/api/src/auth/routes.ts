import { Elysia, t } from "elysia";
import { emailSchema, localeSchema, otpCodeSchema } from "../lib/schemas";
import { SESSION_SECURITY } from "../openapi";
import { fail } from "./http";
import type { OtpService } from "./otp-service";
import { routeKit, type KitServices, type RouteOptions } from "./route-kit";

export interface AuthServices extends KitServices {
  otp: OtpService;
}

/**
 * Auth endpoints. Services are resolved per request so importing this stays
 * side-effect free. `secureCookies` is true in production (HTTPS); `trustProxy`
 * says whether X-Forwarded-For can be believed for the rate limits.
 */
export function authRoutes(getServices: () => AuthServices, opts: RouteOptions) {
  const { http, plugins } = routeKit(getServices, opts);

  return new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
    .use(plugins)
    .post(
      "/otp/request",
      async ({ body }) => {
        await getServices().otp.request(body.email, body.locale);
        // Same answer whether a code was sent, throttled or the mail failed.
        return { ok: true as const };
      },
      {
        body: t.Object({ email: emailSchema, locale: t.Optional(localeSchema) }),
        rateLimit: { otpRequestEmail: "body.email", otpRequestIp: "ip" },
      },
    )
    .post(
      "/otp/verify",
      async ({ body, set }) => {
        const result = await getServices().otp.verify(body.email, body.code);
        // One answer for wrong, expired, used, locked or unknown.
        if (!result.ok) return fail(set, 401, "invalid_code");
        await http.startSession(set, result.user);
        return { ok: true as const, user: result.user };
      },
      {
        body: t.Object({ email: emailSchema, code: otpCodeSchema }),
        rateLimit: { otpVerifyEmail: "body.email", otpVerifyIp: "ip" },
      },
    )
    // Minimal "who am I" (from the session). The full profile is GET /me.
    .get(
      "/session",
      async ({ headers, set }) => {
        const user = await http.authenticate(headers, set);
        if (!user) return fail(set, 401, "unauthenticated");
        return { ok: true as const, user };
      },
      { detail: { security: SESSION_SECURITY, description: "The logged-in user, or 401 `unauthenticated`." } },
    )
    // Fresh login, step 1: email a code to the logged-in account. Needed before a permission
    // marked FRESH_LOGIN_REQUIRED (the guard answers 403 reauth_required until then).
    .post(
      "/reauth/request",
      async ({ user, set }) => {
        // A passkey-only account has no mailbox to prove (a passkey re-check is not built yet).
        if (!user.email) return fail(set, 409, "no_email");
        await getServices().otp.request(user.email, user.locale, "reauth");
        // Same answer whether a code was sent or held back by the 60 s cooldown.
        return { ok: true as const };
      },
      { auth: "me.manage", rateLimit: { otpRequestEmail: "user.email", otpRequestIp: "ip" } },
    )
    // Fresh login, step 2: the right code makes this session fresh for FRESH_LOGIN_MS.
    .post(
      "/reauth/verify",
      async ({ user, authSession, body, set }) => {
        if (!user.email) return fail(set, 409, "no_email");
        const { otp, session } = getServices();
        // 400, not 401: the session itself is still fine.
        if (!(await otp.checkCode(user.email, body.code))) return fail(set, 400, "invalid_code");
        const freshUntil = await session.markFresh(authSession.id);
        return { ok: true as const, freshUntil: freshUntil.toISOString() };
      },
      {
        auth: "me.manage",
        rateLimit: { otpVerifyEmail: "user.email", otpVerifyIp: "ip" },
        audit: { action: "session.reauth", target: "self" },
        body: t.Object({ code: otpCodeSchema }),
      },
    )
    .post("/logout", async ({ headers, set }) => {
      const token = http.tokenFrom(headers);
      if (token) await getServices().session.destroy(token);
      set.headers["set-cookie"] = http.clearCookie();
      return { ok: true as const };
    });
}

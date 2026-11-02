import { Elysia, t } from "elysia";
import { normalizeDisplayName } from "../me/me-service";
import { emailSchema, localeSchema, otpCodeSchema, signupProfileSchema } from "../lib/schemas";
import { SESSION_SECURITY } from "../openapi";
import { fail } from "./http";
import type { NewAccountProfile } from "./user";
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
    // The email limits are per email AND IP, so nobody can use up an address's limits from far away and lock its owner out.
    // Guessing stays capped without a per-email count: 5 guesses per code, and a new code at most once a minute.
    .post(
      "/otp/request",
      async ({ body }) => {
        await getServices().otp.request(body.email, body.locale);
        // Same answer whether a code was sent, throttled or the mail failed.
        return { ok: true as const };
      },
      {
        body: t.Object({ email: emailSchema, locale: t.Optional(localeSchema) }),
        rateLimit: { otpRequestEmail: "body.email+ip", otpRequestIp: "ip" },
      },
    )
    .post(
      "/otp/verify",
      async ({ body, set }) => {
        // Name and origin are only used if this code creates the account (register); login just omits them.
        let profile: NewAccountProfile | undefined;
        if (body.profile) {
          const displayName = normalizeDisplayName(body.profile.displayName);
          if (displayName === undefined) return fail(set, 400, "invalid_display_name");
          profile = { displayName, origin: body.profile.origin ?? null, locale: body.profile.locale ?? "ja" };
        }
        const result = await getServices().otp.verify(body.email, body.code, profile);
        // One answer for wrong, expired, used, locked or unknown.
        if (!result.ok) return fail(set, 401, "invalid_code");
        await http.startSession(set, result.user);
        return { ok: true as const, user: result.user };
      },
      {
        body: t.Object({ email: emailSchema, code: otpCodeSchema, profile: t.Optional(signupProfileSchema) }),
        rateLimit: { otpVerifyEmail: "body.email+ip", otpVerifyIp: "ip" },
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
    // Add an email to a passkey-only account, step 1: mail a code to the new address. Needs a fresh login.
    // The answer is the same whether or not the address belongs to someone (the check happens at step 2).
    .post(
      "/email/request",
      async ({ user, body, set }) => {
        if (user.email) return fail(set, 409, "email_in_use");
        await getServices().otp.request(body.email, user.locale);
        return { ok: true as const };
      },
      {
        auth: "me.sensitive",
        body: t.Object({ email: emailSchema }),
        rateLimit: { otpRequestEmail: "body.email+ip", otpRequestIp: "ip" },
      },
    )
    // Step 2: the right code from the new mailbox becomes the account's email.
    .post(
      "/email/verify",
      async ({ user, authSession, body, set }) => {
        if (user.email) return fail(set, 409, "email_in_use");
        const result = await getServices().otp.attachEmail(user.id, body.email, body.code);
        if (result === "ok") {
          // The account's way back in changed: every other device is signed out, this one stays.
          await getServices().session.endOthers(user.id, authSession.id);
          return { ok: true as const };
        }
        // "taken" is only said after the code was right, so only the mailbox's owner can learn it.
        return result === "taken" ? fail(set, 409, "email_in_use") : fail(set, 400, "invalid_code");
      },
      {
        auth: "me.sensitive",
        body: t.Object({ email: emailSchema, code: otpCodeSchema }),
        rateLimit: { otpVerifyEmail: "body.email+ip", otpVerifyIp: "ip" },
        // The audit row is written by the store, in the same transaction as the change.
      },
    )
    .post("/logout",async ({ headers, set }) => {
      const token = http.tokenFrom(headers);
      if (token) {
        const user = await http.authenticate(headers, set);
        if (user) await http.auditStaff(user, "session.logout");
        await getServices().session.destroy(token);
      }
      set.headers["set-cookie"] = http.clearCookie();
      return { ok: true as const };
    });
}

import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { Elysia, t } from "elysia";
import type { AuditWriter } from "../audit/audit-log";
import { auditTrail } from "../audit/audit-trail";
import { authGuards } from "./guards";
import { createHttpHelpers } from "./http";
import type { PasskeyService } from "./passkey-service";
import { AUTH_LIMITS, type RateLimiter } from "./rate-limit";
import type { SessionService } from "./session-service";

export interface PasskeyServices {
  passkeys: PasskeyService;
  session: SessionService;
  rateLimit: RateLimiter;
  audit: AuditWriter;
}

const str = (max = 4096) => t.String({ maxLength: max });

/** What the browser's navigator.credentials.create() result looks like once turned into JSON. */
const registrationResponse = t.Object(
  {
    id: str(1024),
    rawId: str(1024),
    type: t.Literal("public-key"),
    response: t.Object(
      {
        clientDataJSON: str(8192),
        attestationObject: str(16384),
        authenticatorData: t.Optional(str(8192)),
        transports: t.Optional(t.Array(str(32), { maxItems: 8 })),
        publicKeyAlgorithm: t.Optional(t.Number()),
        publicKey: t.Optional(str(2048)),
      },
      { additionalProperties: false },
    ),
    authenticatorAttachment: t.Optional(str(32)),
    clientExtensionResults: t.Record(t.String(), t.Any()),
  },
  { additionalProperties: false },
);

/** What navigator.credentials.get() returns, as JSON. userHandle is absent or null for non-discoverable keys. */
const authenticationResponse = t.Object(
  {
    id: str(1024),
    rawId: str(1024),
    type: t.Literal("public-key"),
    response: t.Object(
      {
        clientDataJSON: str(8192),
        authenticatorData: str(8192),
        signature: str(4096),
        userHandle: t.Optional(t.Union([str(256), t.Null()])),
      },
      { additionalProperties: false },
    ),
    authenticatorAttachment: t.Optional(str(32)),
    clientExtensionResults: t.Record(t.String(), t.Any()),
  },
  { additionalProperties: false },
);

/** Passkey endpoints. Registration needs a logged-in session; login is how you get one. */
export function passkeyRoutes(
  getServices: () => PasskeyServices,
  opts: { secureCookies: boolean; trustProxy?: boolean },
) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: opts.trustProxy ?? false,
    getSession: () => getServices().session,
  });

  return new Elysia({ prefix: "/auth/passkeys", detail: { tags: ["Passkeys"] } })
    // `auth: "me.manage"` on a route = must be logged in (401 otherwise); `user` is then set.
    .use(authGuards({ getSession: () => getServices().session, secureCookies: opts.secureCookies }))
    // `audit: "<action>"` on a route = record it (user id + target id only) when it succeeds.
    .use(auditTrail({ getAudit: () => getServices().audit }))
    // The account's passkeys, for the settings screen. No key material, only id, name and date.
    .get(
      "/",
      async ({ user }) => {
        const list = await getServices().passkeys.list(user);
        return { ok: true as const, passkeys: list };
      },
      { auth: "me.manage" },
    )
    // Remove one of your own passkeys. The owner is emailed.
    .delete(
      "/:id",
      async ({ user, set, params }) => {
        const { passkeys, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeyRemoveUser, identifier: user.id }]),
        );
        if (limited) return limited;

        const result = await passkeys.remove(user, params.id);
        if (!result.ok) {
          // Someone else's passkey looks exactly like one that does not exist.
          set.status = result.reason === "not_found" ? 404 : 409;
          return {
            ok: false as const,
            error: result.reason === "not_found" ? ("not_found" as const) : ("last_login_method" as const),
          };
        }
        return { ok: true as const };
      },
      {
        auth: "me.manage",
        audit: "passkey.remove", // target: the :id removed
        params: t.Object({ id: t.String({ pattern: "^[0-9a-fA-F-]{36}$" }) }),
      },
    )
    // Step 1: the browser asks for registration settings.
    .post(
      "/register/options",
      async ({ user, set }) => {
        const { passkeys, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeyRegisterUser, identifier: user.id }]),
        );
        if (limited) return limited;

        const result = await passkeys.registrationOptions(user);
        if (!result.ok) {
          set.status = 409;
          return { ok: false as const, error: "too_many_passkeys" as const };
        }
        return { ok: true as const, options: result.options };
      },
      { auth: "me.manage" },
    )
    // Step 3: the browser sends back what the phone signed.
    .post(
      "/register/verify",
      async ({ user, set, body }) => {
        const { passkeys, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeyRegisterUser, identifier: user.id }]),
        );
        if (limited) return limited;

        const result = await passkeys.verifyRegistration(
          user,
          body.response as RegistrationResponseJSON,
          body.label?.trim() || null,
        );
        if (!result.ok) {
          set.status = result.reason === "too_many" ? 409 : 400;
          return {
            ok: false as const,
            error: result.reason === "too_many" ? ("too_many_passkeys" as const) : ("registration_failed" as const),
          };
        }
        return { ok: true as const, passkey: result.passkey };
      },
      {
        auth: "me.manage",
        audit: { action: "passkey.add", target: "response:passkey.id" }, // the new passkey's id
        body: t.Object({ response: registrationResponse, label: t.Optional(t.String({ maxLength: 64 })) }),
      },
    )
    // Sign up with a passkey alone, no email. Step 1: nobody is logged in and no account exists yet.
    .post("/signup/options", async ({ set, ...ctx }) => {
      const { passkeys, rateLimit } = getServices();
      const limited = http.tooMany(
        set,
        await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeySignupIp, identifier: http.ipOf(ctx) }]),
      );
      if (limited) return limited;

      return { ok: true as const, options: await passkeys.signupOptions() };
    })
    // Step 3: a good passkey creates the account and logs it in.
    .post(
      "/signup/verify",
      async ({ body, set, ...ctx }) => {
        const { passkeys, session, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeySignupIp, identifier: http.ipOf(ctx) }]),
        );
        if (limited) return limited;

        const result = await passkeys.verifySignup(body.response as RegistrationResponseJSON, body.label?.trim() || null);
        if (!result.ok) {
          set.status = 400;
          return { ok: false as const, error: "registration_failed" as const };
        }
        const { token, expiresAt } = await session.create(result.user);
        set.headers["set-cookie"] = http.cookieFor(token, expiresAt);
        return { ok: true as const, user: result.user };
      },
      { body: t.Object({ response: registrationResponse, label: t.Optional(t.String({ maxLength: 64 })) }) },
    )
    // Login step 1: no session and no email yet.
    .post("/login/options", async ({ set, ...ctx }) => {
      const { passkeys, rateLimit } = getServices();
      const limited = http.tooMany(
        set,
        await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeyLoginIp, identifier: http.ipOf(ctx) }]),
      );
      if (limited) return limited;

      return { ok: true as const, options: await passkeys.loginOptions() };
    })
    // Login step 3: a good signature starts a session, exactly like the email code does.
    .post(
      "/login/verify",
      async ({ body, set, ...ctx }) => {
        const { passkeys, session, rateLimit } = getServices();
        const limited = http.tooMany(
          set,
          await rateLimit.checkAll([{ rule: AUTH_LIMITS.passkeyLoginIp, identifier: http.ipOf(ctx) }]),
        );
        if (limited) return limited;

        const response = {
          ...body.response,
          response: { ...body.response.response, userHandle: body.response.response.userHandle ?? undefined },
        } as AuthenticationResponseJSON;
        const result = await passkeys.verifyLogin(response);
        if (!result.ok) {
          // One answer for unknown passkey, bad signature, expired or reused challenge.
          set.status = 401;
          return { ok: false as const, error: "login_failed" as const };
        }
        const { token, expiresAt } = await session.create(result.user);
        set.headers["set-cookie"] = http.cookieFor(token, expiresAt);
        return { ok: true as const, user: result.user };
      },
      { body: t.Object({ response: authenticationResponse }) },
    );
}

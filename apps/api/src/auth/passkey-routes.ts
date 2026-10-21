import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { Elysia, t } from "elysia";
import { normalizeDisplayName } from "../me/me-service";
import { signupProfileSchema, uuidParams } from "../lib/schemas";
import { fail } from "./http";
import type { PasskeyService } from "./passkey-service";
import { routeKit, type KitServices, type RouteOptions } from "./route-kit";

export interface PasskeyServices extends KitServices {
  passkeys: PasskeyService;
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

/** Sign-up: the registration answer plus who is signing up (name required, origin optional). */
const signupBody = t.Object({
  response: registrationResponse,
  label: t.Optional(t.String({ maxLength: 64 })),
  profile: signupProfileSchema,
});

/** A registration answer plus the optional name the person gives the passkey. */
const registrationBody = t.Object({ response: registrationResponse, label: t.Optional(t.String({ maxLength: 64 })) });

/** Passkey endpoints. Registration needs a logged-in session; login is how you get one. */
export function passkeyRoutes(getServices: () => PasskeyServices, opts: RouteOptions) {
  const { http, plugins } = routeKit(getServices, opts);

  return (
    new Elysia({ prefix: "/auth/passkeys", detail: { tags: ["Passkeys"] } })
      .use(plugins)
      // The account's passkeys, for the settings screen. No key material, only id, name and date.
      .get("/", async ({ user }) => ({ ok: true as const, passkeys: await getServices().passkeys.list(user) }), {
        auth: "me.manage",
      })
      // Remove one of your own passkeys. The owner is emailed.
      .delete(
        "/:id",
        async ({ user, authSession, set, params }) => {
          const result = await getServices().passkeys.remove(user, params.id);
          if (result.ok) {
            // The owner may be removing a lost phone's key: no other device stays signed in.
            await getServices().session.endOthers(user.id, authSession.id);
            return { ok: true as const };
          }
          // Someone else's passkey looks exactly like one that does not exist.
          return result.reason === "not_found" ? fail(set, 404, "not_found") : fail(set, 409, "last_login_method");
        },
        {
          auth: "me.sensitive",
          rateLimit: { passkeyRemoveUser: "user.id" },
          audit: "passkey.remove", // target: the :id removed
          params: uuidParams,
        },
      )
      // Fresh login with a passkey (the phone's face, fingerprint or lock code), step 1. A passkey-only account has
      // no mailbox, so this is how it proves it is the owner again before a sensitive action.
      .post(
        "/reauth/options",
        async ({ user, set }) => {
          const options = await getServices().passkeys.reauthOptions(user);
          return options ? { ok: true as const, options } : fail(set, 409, "no_passkey");
        },
        { auth: "me.manage", rateLimit: { passkeyReauthUser: "user.id" } },
      )
      // Fresh login with a passkey, step 3: a good signature makes this session fresh for FRESH_LOGIN_MS.
      .post(
        "/reauth/verify",
        async ({ user, authSession, body, set }) => {
          const response = {
            ...body.response,
            response: { ...body.response.response, userHandle: body.response.response.userHandle ?? undefined },
          } as AuthenticationResponseJSON;
          // 400, not 401: the session itself is still fine.
          if (!(await getServices().passkeys.verifyReauth(user, response))) return fail(set, 400, "reauth_failed");
          const freshUntil = await getServices().session.markFresh(authSession.id);
          return { ok: true as const, freshUntil: freshUntil.toISOString() };
        },
        {
          auth: "me.manage",
          rateLimit: { passkeyReauthUser: "user.id" },
          audit: { action: "session.reauth", target: "self" },
          body: t.Object({ response: authenticationResponse }),
        },
      )
      // Add a passkey, step 1: the browser asks for registration settings.
      .post(
        "/register/options",
        async ({ user, set }) => {
          const result = await getServices().passkeys.registrationOptions(user);
          if (!result.ok) return fail(set, 409, "too_many_passkeys");
          return { ok: true as const, options: result.options };
        },
        { auth: "me.sensitive", rateLimit: { passkeyRegisterUser: "user.id" } },
      )
      // Add a passkey, step 3: the browser sends back what the phone signed.
      .post(
        "/register/verify",
        async ({ user, authSession, set, body }) => {
          const result = await getServices().passkeys.verifyRegistration(
            user,
            body.response as RegistrationResponseJSON,
            body.label?.trim() || null,
          );
          if (result.ok) {
            await getServices().session.endOthers(user.id, authSession.id);
            return { ok: true as const, passkey: result.passkey };
          }
          return result.reason === "too_many" ? fail(set, 409, "too_many_passkeys") : fail(set, 400, "registration_failed");
        },
        {
          auth: "me.sensitive",
          rateLimit: { passkeyRegisterUser: "user.id" },
          audit: { action: "passkey.add", target: "response:passkey.id" }, // the new passkey's id
          body: registrationBody,
        },
      )
      // Sign up with a passkey alone, no email. Step 1: nobody is logged in and no account exists yet.
      .post("/signup/options", async () => ({ ok: true as const, options: await getServices().passkeys.signupOptions() }), {
        rateLimit: { passkeySignupIp: "ip" },
      })
      // Sign-up step 3: a good passkey creates the account (with the name and origin given) and logs it in.
      .post(
        "/signup/verify",
        async ({ body, set }) => {
          // Checked before the passkey is spent: a bad name should not burn the challenge.
          const displayName = normalizeDisplayName(body.profile.displayName);
          if (!displayName) return fail(set, 400, "invalid_display_name");
          const result = await getServices().passkeys.verifySignup(
            body.response as RegistrationResponseJSON,
            body.label?.trim() || null,
            { displayName, origin: body.profile.origin ?? null, locale: body.profile.locale ?? "ja" },
          );
          if (!result.ok) return fail(set, 400, "registration_failed");
          await http.startSession(set, result.user);
          return { ok: true as const, user: result.user };
        },
        { body: signupBody, rateLimit: { passkeySignupIp: "ip" } },
      )
      // Login step 1: no session and no email yet.
      .post("/login/options", async () => ({ ok: true as const, options: await getServices().passkeys.loginOptions() }), {
        rateLimit: { passkeyLoginIp: "ip" },
      })
      // Login step 3: a good signature starts a session, exactly like the email code does.
      .post(
        "/login/verify",
        async ({ body, set }) => {
          const response = {
            ...body.response,
            response: { ...body.response.response, userHandle: body.response.response.userHandle ?? undefined },
          } as AuthenticationResponseJSON;
          const result = await getServices().passkeys.verifyLogin(response);
          // One answer for unknown passkey, bad signature, expired or reused challenge.
          if (!result.ok) return fail(set, 401, "login_failed");
          await http.startSession(set, result.user);
          return { ok: true as const, user: result.user };
        },
        { body: t.Object({ response: authenticationResponse }), rateLimit: { passkeyLoginIp: "ip" } },
      )
  );
}

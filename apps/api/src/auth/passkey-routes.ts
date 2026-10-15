import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { Elysia, t } from "elysia";
import { createHttpHelpers } from "./http";
import type { PasskeyService } from "./passkey-service";
import { AUTH_LIMITS, type RateLimiter } from "./rate-limit";
import type { SessionService } from "./session-service";

export interface PasskeyServices {
  passkeys: PasskeyService;
  session: SessionService;
  rateLimit: RateLimiter;
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

/** Passkey endpoints. All of them need a logged-in session. */
export function passkeyRoutes(
  getServices: () => PasskeyServices,
  opts: { secureCookies: boolean; trustProxy?: boolean },
) {
  const http = createHttpHelpers({
    secureCookies: opts.secureCookies,
    trustProxy: opts.trustProxy ?? false,
    getSession: () => getServices().session,
  });

  return new Elysia({ prefix: "/auth/passkeys" })
    // Step 1: the browser asks for registration settings.
    .post("/register/options", async ({ headers, set }) => {
      const user = await http.authenticate(headers, set);
      if (!user) {
        set.status = 401;
        return { ok: false as const, error: "unauthenticated" as const };
      }
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
    })
    // Step 3: the browser sends back what the phone signed.
    .post(
      "/register/verify",
      async ({ headers, set, body }) => {
        const user = await http.authenticate(headers, set);
        if (!user) {
          set.status = 401;
          return { ok: false as const, error: "unauthenticated" as const };
        }
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
      { body: t.Object({ response: registrationResponse, label: t.Optional(t.String({ maxLength: 64 })) }) },
    );
}

import { openapi } from "@elysia/openapi";

/** The cookie that every logged-in route needs, as an OpenAPI security scheme. */
export const SESSION_SECURITY = [{ session: [] }];

/**
 * API documentation, generated from the routes themselves:
 *   /api/v1/openapi        interactive docs (Scalar), with "Try it" buttons
 *   /api/v1/openapi/json   the OpenAPI document (import it into Postman by URL)
 *
 * Off in production by default: it lists every endpoint, which helps nobody but an
 * attacker there. Set API_DOCS=true to turn it on anyway.
 */
export function apiDocs(opts: { enabled: boolean }) {
  return openapi({
    enabled: opts.enabled,
    path: "/openapi",
    documentation: {
      info: {
        title: "KTRG API",
        version: "1.0.0",
        description: [
          "The KTRG API.",
          "",
          "**Logging in:** call `POST /auth/otp/request`, then `POST /auth/otp/verify` with the 6-digit code",
          "(emailed, or printed in the API terminal when `SMTP_HOST` is empty). The answer sets the `session`",
          "cookie, which the browser and Postman then send with every request.",
          "",
          "Rate limits answer `429` with a `Retry-After` header. Passkey *verify* steps need a real",
          "authenticator, so try those on the dev page (`bun run phone:test`).",
        ].join("\n"),
      },
      tags: [
        { name: "Health", description: "Is the API up?" },
        { name: "Auth", description: "Email-code login, session, logout and the fresh-login re-check." },
        { name: "Passkeys", description: "Add, list and remove passkeys; log in or sign up with one." },
        { name: "Me", description: "The logged-in account's own profile and deletion request." },
      ],
      components: {
        securitySchemes: {
          session: {
            type: "apiKey",
            in: "cookie",
            name: "session",
            description: "Set by POST /auth/otp/verify or a passkey login. Named `__Host-session` (HTTPS only) in production.",
          },
        },
      },
    },
  });
}

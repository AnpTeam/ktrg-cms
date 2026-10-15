import { Elysia } from "elysia";
import { createDrizzleAuditWriter } from "./audit/audit-store";
import { parseAdminEmails } from "./auth/admin-emails";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { passkeyRoutes } from "./auth/passkey-routes";
import { createDrizzlePasskeyStore } from "./auth/passkey-store";
import { createDrizzleRateLimitStore } from "./auth/rate-limit-store";
import { authRoutes } from "./auth/routes";
import { createDrizzleSessionStore } from "./auth/session-store";
import { createDb } from "./db/client";
import { env } from "./env";
import { createMailer } from "./lib/mailer";
import { meRoutes } from "./me/me-routes";
import { createDrizzleMeStore } from "./me/me-store";
import { apiDocs } from "./openapi";
import { createServices, type Services } from "./services";

// Built on first use, so importing the app never opens a database connection.
let services: Services | undefined;
function getServices(): Services {
  if (!services) {
    const { db } = createDb(env.DATABASE_URL);
    services = createServices({
      stores: {
        otp: createDrizzleOtpStore(db),
        session: createDrizzleSessionStore(db),
        rateLimit: createDrizzleRateLimitStore(db),
        passkeys: createDrizzlePasskeyStore(db),
        me: createDrizzleMeStore(db),
      },
      audit: createDrizzleAuditWriter(db),
      mailer: createMailer(env),
      // Production requires the secret (parse-env); this dev fallback never ships.
      secret: env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000",
      adminEmails: parseAdminEmails(env.ADMIN_EMAILS).emails, // checked at boot (parse-env)
      passkey: {
        rpName: "KTRG",
        // Passkeys only work on this domain, so it must be the site users actually visit.
        rpId: env.PASSKEY_RP_ID ?? new URL(env.APP_ORIGIN).hostname,
        origin: env.APP_ORIGIN,
      },
    });
  }
  return services;
}

const routeOpts = { secureCookies: env.NODE_ENV === "production", trustProxy: env.TRUST_PROXY };

export const app = new Elysia({ prefix: "/api/v1" })
  .use(apiDocs({ enabled: env.NODE_ENV !== "production" || env.API_DOCS }))
  .get(
    "/health",
    () => ({
      status: "ok" as const,
    }),
    { detail: { tags: ["Health"], summary: "Is the API up?" } },
  )
  .use(authRoutes(getServices, routeOpts))
  .use(passkeyRoutes(getServices, routeOpts))
  .use(meRoutes(getServices, routeOpts));

export type App = typeof app;

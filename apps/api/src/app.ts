import { Elysia } from "elysia";
import { createDrizzleAuditWriter } from "./audit/audit-store";
import { parseAdminEmails } from "./auth/admin-emails";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { passkeyRoutes } from "./auth/passkey-routes";
import { createDrizzlePasskeyStore } from "./auth/passkey-store";
import { createDrizzleRateLimitStore } from "./auth/rate-limit-store";
import type { RouteOptions } from "./auth/route-kit";
import { authRoutes } from "./auth/routes";
import { createDrizzleSessionStore } from "./auth/session-store";
import { createDb } from "./db/client";
import { env } from "./env";
import { apiBase } from "./lib/api-errors";
import { createMailer } from "./lib/mailer";
import { purgeRoutes } from "./internal/purge-routes";
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

/**
 * The whole API: every route file, mounted under /api/v1. The services come from outside, so
 * the tests and the dev page (scripts/phone-test.ts) run exactly this route tree on memory stores.
 */
export function createApp(getServices: () => Services, opts: RouteOptions & { docs: boolean; cronSecret?: string }) {
  return new Elysia({ prefix: "/api/v1" })
    .use(apiBase()) // first: request ids and the one error shape, for everything below
    .use(apiDocs({ enabled: opts.docs }))
    .get(
      "/health",
      () => ({
        status: "ok" as const,
      }),
      { detail: { tags: ["Health"], summary: "Is the API up?" } },
    )
    .use(authRoutes(getServices, opts))
    .use(passkeyRoutes(getServices, opts))
    .use(meRoutes(getServices, opts))
    .use(purgeRoutes(getServices, opts.cronSecret));
}

export const app = createApp(getServices, {
  secureCookies: env.NODE_ENV === "production",
  trustProxy: env.TRUST_PROXY,
  docs: env.NODE_ENV !== "production" || env.API_DOCS,
  cronSecret: env.CRON_SECRET,
});

export type App = typeof app;
/** The `{ ok: false, error }` body of every failure, for the web app's error handling. */
export type { ApiError, ErrorCode, ValidationIssue } from "./lib/api-errors";

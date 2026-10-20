import { Elysia } from "elysia";
import { createDrizzleAuditWriter } from "./audit/audit-store";
import { parseAdminEmails } from "./auth/admin-emails";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { adminContentRoutes } from "./content/admin-routes";
import { createDrizzleContentStore } from "./content/content-store";
import { createDrizzleRallyAdminStore } from "./rallies/rally-admin-store";
import { rallyAdminRoutes } from "./rallies/rally-admin-routes";
import { publicContentRoutes } from "./content/public-routes";
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
import { createRoutingService } from "./routing/routing-service";
import { createServices, type Services } from "./services";
import { uploadRoutes } from "./uploads/upload-routes";
import { createR2Storage } from "./uploads/upload-storage";

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
        content: createDrizzleContentStore(db),
        rallyAdmin: createDrizzleRallyAdminStore(db),
      },
      audit: createDrizzleAuditWriter(db),
      mailer: createMailer(env),
      routing: createRoutingService({ apiKey: env.ORS_API_KEY }),
      photoHosts: env.PHOTO_HOSTS?.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
      // Production requires the secret (parse-env); this dev fallback never ships.
      secret: env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000",
      adminEmails: parseAdminEmails(env.ADMIN_EMAILS).emails, // checked at boot (parse-env)
      passkey: {
        rpName: "KTRG",
        // Passkeys only work on this domain, so it must be the site users actually visit.
        rpId: env.PASSKEY_RP_ID ?? new URL(env.APP_ORIGIN).hostname,
        origin: env.APP_ORIGIN,
      },
      // All five R2 settings or none (parse-env checks): without them uploads answer 503.
      uploads: env.R2_BUCKET_NAME
        ? {
            storage: createR2Storage({
              accountId: env.R2_ACCOUNT_ID!,
              accessKeyId: env.R2_ACCESS_KEY_ID!,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
              bucket: env.R2_BUCKET_NAME,
            }),
            publicBaseUrl: env.R2_PUBLIC_URL!,
          }
        : undefined,
    });
  }
  return services;
}

/**
 * The whole API: every route file, mounted under /api/v1. The services come from outside, so
 * the tests and the dev page (scripts/phone-test.ts) run exactly this route tree on memory stores.
 */
export function createApp(
  getServices: () => Services,
  opts: RouteOptions & { docs: boolean; cronSecret?: string; appOrigin?: () => string },
) {
  return new Elysia({ prefix: "/api/v1" })
    .use(apiBase({ allowedOrigin: opts.appOrigin })) // first: request ids, the Origin check and the one error shape
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
    .use(adminContentRoutes(getServices, opts))
    .use(publicContentRoutes(() => getServices().content))
    .use(uploadRoutes(getServices, opts))
    .use(rallyAdminRoutes(getServices, opts))
    .use(purgeRoutes(getServices, opts.cronSecret));
}

export const app = createApp(getServices, {
  secureCookies: env.NODE_ENV === "production",
  trustProxy: env.TRUST_PROXY,
  docs: env.NODE_ENV !== "production" || env.API_DOCS,
  cronSecret: env.CRON_SECRET,
  appOrigin: () => env.APP_ORIGIN,
});

// Vercel's entry: its Elysia preset picks the first of app.ts, index.ts, server.ts, src/app.ts,
// src/index.ts, src/server.ts that exists, and needs the app as the default export (no listen()).
// This file comes first, so it is the one. Importing ./env above still fails fast on a bad environment.
export default app;

export type App = typeof app;
/** The `{ ok: false, error }` body of every failure, for the web app's error handling. */
export type { ApiError, ErrorCode, ValidationIssue } from "./lib/api-errors";

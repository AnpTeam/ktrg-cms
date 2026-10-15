import { Elysia } from "elysia";
import { createOtpService } from "./auth/otp-service";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { createRateLimiter } from "./auth/rate-limit";
import { createDrizzleRateLimitStore } from "./auth/rate-limit-store";
import { createPasskeyService } from "./auth/passkey-service";
import { createDrizzlePasskeyStore } from "./auth/passkey-store";
import { passkeyRoutes, type PasskeyServices } from "./auth/passkey-routes";
import { authRoutes, type AuthServices } from "./auth/routes";
import { createSessionService } from "./auth/session-service";
import { createDrizzleSessionStore } from "./auth/session-store";
import { createDb } from "./db/client";
import { env } from "./env";
import { createMailer } from "./lib/mailer";

// Built on first use, so importing the app never opens a database connection.
let services: (AuthServices & PasskeyServices) | undefined;
function getServices(): AuthServices & PasskeyServices {
  if (!services) {
    const { db } = createDb(env.DATABASE_URL);
    // Production requires the secret (parse-env); this dev fallback never ships.
    const secret = env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000";
    const mailer = createMailer(env);
    services = {
      otp: createOtpService({ store: createDrizzleOtpStore(db), mailer, secret }),
      session: createSessionService({ store: createDrizzleSessionStore(db) }),
      rateLimit: createRateLimiter({ store: createDrizzleRateLimitStore(db), secret }),
      passkeys: createPasskeyService({
        store: createDrizzlePasskeyStore(db),
        mailer, // emails the owner when a passkey is added or removed
        config: {
          rpName: "KTRG",
          // Passkeys only work on this domain, so it must be the site users actually visit.
          rpId: env.PASSKEY_RP_ID ?? new URL(env.APP_ORIGIN).hostname,
          origin: env.APP_ORIGIN,
        },
      }),
    };
  }
  return services;
}

const routeOpts = { secureCookies: env.NODE_ENV === "production", trustProxy: env.TRUST_PROXY };

export const app = new Elysia({ prefix: "/api/v1" })
  .get("/health", () => ({
    status: "ok" as const,
  }))
  .use(authRoutes(getServices, routeOpts))
  .use(passkeyRoutes(getServices, routeOpts));

export type App = typeof app;

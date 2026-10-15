import { Elysia } from "elysia";
import { createOtpService } from "./auth/otp-service";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { authRoutes, type AuthServices } from "./auth/routes";
import { createSessionService } from "./auth/session-service";
import { createDrizzleSessionStore } from "./auth/session-store";
import { createDb } from "./db/client";
import { env } from "./env";
import { createMailer } from "./lib/mailer";

// Built on first use, so importing the app never opens a database connection.
let services: AuthServices | undefined;
function getServices(): AuthServices {
  if (!services) {
    const { db } = createDb(env.DATABASE_URL);
    services = {
      otp: createOtpService({
        store: createDrizzleOtpStore(db),
        mailer: createMailer(env),
        // Production requires the secret (parse-env); this dev fallback never ships.
        secret: env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000",
      }),
      session: createSessionService({ store: createDrizzleSessionStore(db) }),
    };
  }
  return services;
}

export const app = new Elysia({ prefix: "/api/v1" })
  .get("/health", () => ({
    status: "ok" as const,
  }))
  .use(authRoutes(getServices, { secureCookies: env.NODE_ENV === "production" }));

export type App = typeof app;

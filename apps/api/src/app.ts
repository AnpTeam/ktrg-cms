import { Elysia } from "elysia";
import { createOtpService, type OtpService } from "./auth/otp-service";
import { createDrizzleOtpStore } from "./auth/otp-store";
import { authRoutes } from "./auth/routes";
import { createDb } from "./db/client";
import { env } from "./env";
import { createMailer } from "./lib/mailer";

// Built on first use, so importing the app never opens a database connection.
let otpService: OtpService | undefined;
function getOtpService(): OtpService {
  otpService ??= createOtpService({
    store: createDrizzleOtpStore(createDb(env.DATABASE_URL).db),
    mailer: createMailer(env),
    // Production requires the secret (parse-env); this dev fallback never ships.
    secret: env.OTP_HMAC_SECRET ?? "dev-only-otp-secret-change-me-0000000",
  });
  return otpService;
}

export const app = new Elysia({ prefix: "/api/v1" })
  .get("/health", () => ({
    status: "ok" as const,
  }))
  .use(authRoutes(getOtpService));

export type App = typeof app;

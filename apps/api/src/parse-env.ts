import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { parseAdminEmails } from "./auth/admin-emails";

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal("development"), Type.Literal("test"), Type.Literal("production")],
    { default: "development" },
  ),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3001 }),
  // Optional until the database is wired up (WBS 1.2.x).
  DATABASE_URL: Type.Optional(Type.String({ pattern: "^postgres(ql)?://.+" })),
  APP_ORIGIN: Type.String({ pattern: "^https?://[^/]+$", default: "http://localhost:3000" }),
  // Mail (WBS 2.1.1). Without SMTP_HOST, non-production logs emails to the console.
  SMTP_HOST: Type.Optional(Type.String()),
  SMTP_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 587 }),
  SMTP_USER: Type.Optional(Type.String()),
  SMTP_PASS: Type.Optional(Type.String()),
  MAIL_FROM: Type.String({ minLength: 3, default: "KTRG <no-reply@localhost>" }),
  // Key for hashing one-time codes (WBS 2.1.3). Required in production.
  OTP_HMAC_SECRET: Type.Optional(Type.String({ minLength: 32 })),
  // Passkeys (WBS 2.1.7). Defaults to the hostname of APP_ORIGIN; set it only to share
  // passkeys across subdomains (use the parent domain, e.g. example.com).
  PASSKEY_RP_ID: Type.Optional(Type.String({ minLength: 1 })),
  // Set only behind a trusted reverse proxy (e.g. Vercel): the client IP is then read
  // from X-Forwarded-For. Otherwise that header is ignored (it can be forged).
  TRUST_PROXY: Type.Boolean({ default: false }),
  // First admin: comma-separated emails promoted to admin when they log in
  // with an email code. Promote-only: removing an address later does not demote anyone.
  ADMIN_EMAILS: Type.Optional(Type.String()),
});

export type Env = Static<typeof EnvSchema>;

/** Validate a raw environment; throws one error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const candidate = Value.Default(EnvSchema, Value.Convert(EnvSchema, { ...source }));
  const first = new Map<string, string>();
  for (const e of Value.Errors(EnvSchema, candidate)) {
    if (!first.has(e.path)) first.set(e.path, e.message);
  }
  const rawAdmins = (candidate as { ADMIN_EMAILS?: unknown }).ADMIN_EMAILS;
  const badAdmins = parseAdminEmails(typeof rawAdmins === "string" ? rawAdmins : undefined).invalid;
  if (badAdmins.length > 0 && !first.has("/ADMIN_EMAILS")) {
    first.set("/ADMIN_EMAILS", `not an email address: ${badAdmins.join(", ")}`);
  }
  if (first.size > 0) {
    const lines = [...first].map(([path, msg]) => `  - ${path.slice(1) || "(root)"}: ${msg}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  const env = Value.Clean(EnvSchema, candidate) as Env;
  if (env.NODE_ENV === "production" && !env.OTP_HMAC_SECRET) {
    throw new Error("Invalid environment:\n  - OTP_HMAC_SECRET: required in production (32+ characters)");
  }
  return env;
}

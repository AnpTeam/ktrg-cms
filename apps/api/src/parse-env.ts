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
  // Secret for the scheduled clean-up (POST /internal/purge-deletions, called hourly by a GitHub Actions workflow).
  // Unset: that route does not exist.
  CRON_SECRET: Type.Optional(Type.String({ minLength: 32 })),
  // Key for OpenRouteService (openrouteservice.org), used only by the admin's "snap to trails". Unset: that button says the
  // service is not set up. Keep it on the server only; never put it in the web app or the repo.
  ORS_API_KEY: Type.Optional(Type.String({ minLength: 10 })),
  // API docs at /api/v1/openapi. Always on outside production; set true to show them there too.
  API_DOCS: Type.Boolean({ default: false }),
  // Photo uploads to Cloudflare R2: all five or none. Unset, partial or malformed: uploads are off
  // (POST /admin/uploads answers 503) and the rest of the API still starts.
  R2_ACCOUNT_ID: Type.Optional(Type.String({ minLength: 1 })),
  R2_ACCESS_KEY_ID: Type.Optional(Type.String({ minLength: 1 })),
  R2_SECRET_ACCESS_KEY: Type.Optional(Type.String({ minLength: 1 })),
  R2_BUCKET_NAME: Type.Optional(Type.String({ minLength: 1 })),
  // The bucket's public address (its r2.dev URL or a custom domain), https and no trailing slash.
  R2_PUBLIC_URL: Type.Optional(Type.String({ pattern: "^https://[^/]+(/[^?#]*[^/?#])?$" })),
  // Comma-separated host names a route or place photo may come from (for example photos.example.com). Unset: any
  // https address is accepted. Set it once photos live in the bucket, so an editor cannot point visitors' browsers
  // at a stranger's server.
  PHOTO_HOSTS: Type.Optional(Type.String()),
});

const R2_SETTINGS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"] as const;

export type Env = Static<typeof EnvSchema>;

/**
 * The database URL: DATABASE_URL, else the names Vercel's Postgres integrations set
 * (DB_POSTGRES_URL with the "DB" prefix chosen when connecting it, or plain POSTGRES_URL).
 */
export function databaseUrlFrom(source: Record<string, string | undefined>): string | undefined {
  return source.DATABASE_URL || source.DB_POSTGRES_URL || source.POSTGRES_URL || undefined;
}

/**
 * Validate a raw environment; throws one error listing every problem. Optional features (R2) are
 * switched off with a logged warning instead, so one wrong photo setting cannot take the API down.
 */
export function parseEnv(source: Record<string, string | undefined>, log: (line: string) => void = console.error): Env {
  const databaseUrl = databaseUrlFrom(source);
  const raw: Record<string, string | undefined> = { ...source, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) };
  // Vercel sets VERCEL, and there the API never sees the visitor's own address: trust the proxy unless told otherwise.
  if (raw.TRUST_PROXY === undefined && raw.VERCEL) raw.TRUST_PROXY = "true";
  const candidate = Value.Default(EnvSchema, Value.Convert(EnvSchema, raw));
  const first = new Map<string, string>();
  for (const e of Value.Errors(EnvSchema, candidate)) {
    if (!first.has(e.path)) first.set(e.path, e.message);
  }
  const rawAdmins = (candidate as { ADMIN_EMAILS?: unknown }).ADMIN_EMAILS;
  const badAdmins = parseAdminEmails(typeof rawAdmins === "string" ? rawAdmins : undefined).invalid;
  if (badAdmins.length > 0 && !first.has("/ADMIN_EMAILS")) {
    first.set("/ADMIN_EMAILS", `not an email address: ${badAdmins.join(", ")}`);
  }
  const settings = candidate as Record<string, unknown>;
  const r2Set = R2_SETTINGS.filter((k) => settings[k] !== undefined);
  const r2Bad = R2_SETTINGS.filter((k) => first.delete(`/${k}`));
  const r2Missing = r2Set.length > 0 ? R2_SETTINGS.filter((k) => !r2Set.includes(k)) : [];
  if (r2Bad.length > 0 || r2Missing.length > 0) {
    // Names only, never values (they include the secret key).
    const why = [r2Missing.length ? `missing ${r2Missing.join(", ")}` : "", r2Bad.length ? `invalid ${r2Bad.join(", ")}` : ""];
    log(`[env] photo uploads are OFF: ${why.filter(Boolean).join("; ")} (all five R2_* settings are needed)`);
    for (const k of R2_SETTINGS) delete settings[k];
  }
  if (first.size > 0) {
    const lines = [...first].map(([path, msg]) => `  - ${path.slice(1) || "(root)"}: ${msg}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  const env = Value.Clean(EnvSchema, candidate) as Env;
  if (env.NODE_ENV === "production" && !env.OTP_HMAC_SECRET) {
    throw new Error("Invalid environment:\n  - OTP_HMAC_SECRET: required in production (32+ characters)");
  }
  if (env.NODE_ENV === "production" && source.TRUST_PROXY === undefined && !source.VERCEL) {
    // Without a decision, every visitor behind a proxy would share one rate-limit bucket.
    throw new Error("Invalid environment:\n  - TRUST_PROXY: set it in production (true behind a reverse proxy, false when the API is reached directly)");
  }
  return env;
}

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["participant", "admin"]);
export const userLocale = pgEnum("user_locale", ["ja", "en"]);
export const webauthnChallengeType = pgEnum("webauthn_challenge_type", [
  "registration",
  "authentication",
]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** One row per person. Created on the first successful OTP login. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored lowercase by the app; the unique index below also enforces it.
    email: text("email").notNull(),
    role: userRole("role").notNull().default("participant"),
    locale: userLocale("locale").notNull().default("ja"),
    displayName: text("display_name"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Set when the user asks to delete their account (GET/PATCH/DELETE /me).
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

/** Cookie sessions. Only the SHA-256 hash of the token is stored, never the token. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    // Sliding expiry (idle) and hard expiry (absolute). Lengths depend on role.
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    // Last full login (OTP or passkey); used for the "fresh login" check.
    authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** WebAuthn credentials (SimpleWebAuthn). Binary values are stored base64url. */
export const passkeys = pgTable(
  "passkeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    transports: text("transports").array(),
    deviceType: text("device_type", { enum: ["singleDevice", "multiDevice"] }).notNull(),
    backedUp: boolean("backed_up").notNull().default(false),
    name: text("name"),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("passkeys_user_id_idx").on(t.userId)],
);

/**
 * One-time email codes. Not linked to users: the user is created only after
 * the first successful verify. Only the HMAC of the code is stored.
 */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  // Looks up the latest code per email (verify + 60 s resend cooldown).
  (t) => [index("otp_codes_email_created_idx").on(t.email, t.createdAt)],
);

/** Short-lived WebAuthn challenges. userId is null for discoverable-credential login. */
export const webauthnChallenges = pgTable(
  "webauthn_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challenge: text("challenge").notNull().unique(),
    type: webauthnChallengeType("type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("webauthn_challenges_expires_idx").on(t.expiresAt)],
);

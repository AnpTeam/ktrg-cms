import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Preferences } from "../../me/preferences";

export const userRole = pgEnum("user_role", ["participant", "admin"]);
export const userLocale = pgEnum("user_locale", ["ja", "en"]);
/** Where a visitor says they come from (asked at sign-up; optional, for knowing who the app serves). */
export const userOrigin = pgEnum("user_origin", ["osaka", "wakayama", "nara", "other_japan", "overseas"]);
/** An age band the visitor picks after registering (optional, for knowing who the app serves). */
export const userAgeRange = pgEnum("user_age_range", ["under20", "20s", "30s", "40s", "50s", "60s", "70plus"]);
/** Optional. "unspecified" is an answer ("I'd rather not say"); null means the question was never answered. */
export const userGender = pgEnum("user_gender", ["female", "male", "other", "unspecified"]);
export const webauthnChallengeType = pgEnum("webauthn_challenge_type", [
  "registration",
  "authentication",
]);

/** PostgreSQL bytea (used for the passkey public key). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * One row per person. Created on the first successful email-code login, or on
 * the first passkey sign-up (which has no email).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The ID the person sees and quotes to support: 8 digits, unique (see lib/public-id.ts). The default needs
    // the sequence user_public_id_seq, which migration 0006 creates; keep the expression in step with publicIdFor.
    publicId: text("public_id")
      .notNull()
      .default(sql`lpad(((nextval('user_public_id_seq') * 48271) % 99999989)::text, 8, '0')`),
    // Null for an account made with a passkey alone. Stored lowercase by the app;
    // the unique index below also enforces it (Postgres allows many nulls).
    email: text("email"),
    role: userRole("role").notNull().default("participant"),
    locale: userLocale("locale").notNull().default("ja"),
    displayName: text("display_name"),
    // Where the person says they come from; null when they did not say.
    origin: userOrigin("origin"),
    // Asked once after registering; both optional and changeable on the profile.
    ageRange: userAgeRange("age_range"),
    gender: userGender("gender"),
    // Accessibility and map choices (see me/preferences.ts); null until the person sets them.
    preferences: jsonb("preferences").$type<Preferences>(),
    // Set by DELETE /me: the owner asked for the account to be deleted. Nothing is deleted
    // yet; cleared again if they cancel. Null when no deletion is pending.
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`), uniqueIndex("users_public_id_uq").on(t.publicId)],
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
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    // Sliding expiry (idle) and hard expiry (absolute). Lengths depend on role.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    // Last full login (OTP or passkey); used for the "fresh login" check.
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** WebAuthn credentials (SimpleWebAuthn). */
export const passkeys = pgTable(
  "passkeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: bytea("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    // Device label shown in settings.
    label: text("label"),
    createdAt: createdAt(),
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
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  // Looks up the latest code per email (verify + 60 s resend cooldown).
  (t) => [index("otp_codes_email_expires_idx").on(t.email, t.expiresAt)],
);

/**
 * Short-lived WebAuthn challenges. userId is null for discoverable-credential
 * login and for passkey sign-up; sign-up also records the id the new account
 * will get (pendingUserId, no foreign key: the user exists only once the passkey verifies).
 */
export const webauthnChallenges = pgTable(
  "webauthn_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challenge: text("challenge").notNull().unique(),
    type: webauthnChallengeType("type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    pendingUserId: uuid("pending_user_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("webauthn_challenges_expires_idx").on(t.expiresAt)],
);

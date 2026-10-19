import type { userAgeRange, userGender, userLocale, userOrigin, userRole } from "../db/schema";

/** The roles an account can have: the user_role type in the database. */
export type Role = (typeof userRole.enumValues)[number];

/** The languages the app speaks (UI, emails): the user_locale type in the database. */
export type Locale = (typeof userLocale.enumValues)[number];

/** Where a visitor comes from: the user_origin type in the database. */
export type Origin = (typeof userOrigin.enumValues)[number];

/** An age band: the user_age_range type in the database. */
export type AgeRange = (typeof userAgeRange.enumValues)[number];

/** A gender answer (including "unspecified"): the user_gender type in the database. */
export type Gender = (typeof userGender.enumValues)[number];

/** What sign-up asks besides the login method. Applied only when the account is created. */
export interface NewAccountProfile {
  /** Already cleaned by normalizeDisplayName. */
  displayName: string | null;
  origin: Origin | null;
  locale: Locale;
}

/** A logged-in account, as the auth code passes it around. */
export interface AuthUser {
  id: string;
  /** Null for an account made with a passkey alone: never assume you can email a user. */
  email: string | null;
  role: Role;
  locale: Locale;
}

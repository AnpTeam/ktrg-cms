import type { userLocale, userRole } from "../db/schema";

/** The roles an account can have: the user_role type in the database. */
export type Role = (typeof userRole.enumValues)[number];

/** The languages the app speaks (UI, emails): the user_locale type in the database. */
export type Locale = (typeof userLocale.enumValues)[number];

/** A logged-in account, as the auth code passes it around. */
export interface AuthUser {
  id: string;
  /** Null for an account made with a passkey alone: never assume you can email a user. */
  email: string | null;
  role: Role;
  locale: Locale;
}

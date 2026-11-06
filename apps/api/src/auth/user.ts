import type { userAgeRange, userFoundVia, userGender, userLocale, userOrigin, userRole } from "../db/schema";

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

/** How they found the rally: the user_found_via type in the database. */
export type FoundVia = (typeof userFoundVia.enumValues)[number];

/** What sign-up asks besides the login method. Applied only when the account is created. */
export interface NewAccountProfile {
  /** Already cleaned by normalizeDisplayName. */
  displayName: string | null;
  origin: Origin | null;
  originPlace?: string | null;
  locale: Locale;
}

/** The plain answer a detailed place belongs to: the three prefectures of the trails, the rest of Japan, or abroad. */
export function originOfPlace(place: string): Origin {
  if (!place.startsWith("JP-")) return "overseas";
  return place === "JP-27" ? "osaka" : place === "JP-30" ? "wakayama" : place === "JP-29" ? "nara" : "other_japan";
}

/** What sign-up saves: with a place the plain answer comes from it, so the two always agree. */
export const signupOrigin = (profile: { origin?: Origin; originPlace?: string }) => ({
  origin: profile.originPlace ? originOfPlace(profile.originPlace) : (profile.origin ?? null),
  originPlace: profile.originPlace ?? null,
});

/** A logged-in account, as the auth code passes it around. */
export interface AuthUser {
  id: string;
  /** Null for an account made with a passkey alone: never assume you can email a user. */
  email: string | null;
  role: Role;
  locale: Locale;
  /** An admin restricted the account (and not yet lifted or ended): see BLOCKED_WHEN_RESTRICTED. Left out means not restricted. */
  restricted?: boolean;
}

import { t, type Static } from "elysia";
import { userAgeRange, userGender, userLocale, userOrigin } from "../db/schema";

/** Request-body pieces shared by several routes, so each rule lives in one place. */

/** An email address, as long as an address can be. */
export const emailSchema = t.String({ format: "email", maxLength: 254 });

/** A 6-digit one-time code (login or fresh-login re-check). */
export const otpCodeSchema = t.String({ pattern: "^[0-9]{6}$" });

/**
 * "ja" or "en": the user_locale values in the database. Written as literals on purpose:
 * t.UnionEnum lets an unknown value such as "fr" through when the field is optional, and a
 * union built by mapping over the enum loses its literal types for the typed web client.
 */
export const localeSchema = t.Union([t.Literal("ja"), t.Literal("en")]);
// Compile-time guard: the build fails if the database enum gains a value this list lacks.
const _localeCovered: Exclude<(typeof userLocale.enumValues)[number], Static<typeof localeSchema>> extends never ? true : never = true;

/** Where the visitor comes from; same literal-union reason as localeSchema. */
export const originSchema = t.Union([
  t.Literal("osaka"),
  t.Literal("wakayama"),
  t.Literal("nara"),
  t.Literal("other_japan"),
  t.Literal("overseas"),
]);
const _originCovered: Exclude<(typeof userOrigin.enumValues)[number], Static<typeof originSchema>> extends never ? true : never = true;
void [_localeCovered, _originCovered];

/** Age band, asked after registering; literal unions for the same reason as originSchema. */
export const ageRangeSchema = t.Union([
  t.Literal("under20"),
  t.Literal("20s"),
  t.Literal("30s"),
  t.Literal("40s"),
  t.Literal("50s"),
  t.Literal("60s"),
  t.Literal("70plus"),
]);
/** "unspecified" is the answer "I'd rather not say". */
export const genderSchema = t.Union([t.Literal("female"), t.Literal("male"), t.Literal("other"), t.Literal("unspecified")]);
const _ageCovered: Exclude<(typeof userAgeRange.enumValues)[number], Static<typeof ageRangeSchema>> extends never ? true : never = true;
const _genderCovered: Exclude<(typeof userGender.enumValues)[number], Static<typeof genderSchema>> extends never ? true : never = true;
void [_ageCovered, _genderCovered];

/** The accessibility and map choices (me/preferences.ts): every field is required, nothing else is allowed. */
export const preferencesSchema = t.Object(
  {
    size: t.Union([t.Literal("standard"), t.Literal("large"), t.Literal("xlarge")]),
    mergeStops: t.Boolean(),
    placesOnMap: t.Boolean(),
    setupDone: t.Boolean(),
    // Milliseconds since 1970, up to the year 2100: a number, never a date string.
    updatedAt: t.Integer({ minimum: 0, maximum: 4102444800000 }),
  },
  { additionalProperties: false },
);

/** The name and origin asked at sign-up. The name is cleaned and checked in the route (normalizeDisplayName). */
export const signupProfileSchema = t.Object(
  {
    displayName: t.String({ maxLength: 200 }),
    origin: t.Optional(originSchema),
    locale: t.Optional(localeSchema),
  },
  { additionalProperties: false },
);

/** A `:id` path parameter that must be a UUID. */
export const uuidParams = t.Object({ id: t.String({ pattern: "^[0-9a-fA-F-]{36}$" }) });

import { t, type Static } from "elysia";
import { userAgeRange, userFoundVia, userGender, userLocale, userOrigin } from "../db/schema";
import type { TNull, TObject, TOptional, TString, TUnion } from "@sinclair/typebox";
import { EXTRA_LOCALES, type ExtraLocale } from "../db/translations";

/** Request-body pieces shared by several routes, so each rule lives in one place. */

/**
 * One of these words, as a union of literals. Not `t.UnionEnum`: it gives the field a default (its first word), and a
 * field left out of a partial change (a PATCH sends only what changed) is then filled with that default and silently
 * overwritten. The Unsafe wrapper keeps the word types for the typed web client.
 */
export const oneOf = <const T extends readonly string[]>(values: T) => t.Unsafe<T[number]>(t.Union(values.map((v) => t.Literal(v))));

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

/** A prefecture (JP-01 to JP-47) or a country other than Japan, as ISO codes. */
export const originPlaceSchema = t.String({ pattern: "^(JP-(0[1-9]|[1-3][0-9]|4[0-7])|(?!JP)[A-Z]{2})$" });

/** Age band, asked after registering; literal unions for the same reason as originSchema. */
export const ageRangeSchema = t.Union([
  t.Literal("under20"),
  t.Literal("20s"),
  t.Literal("30s"),
  t.Literal("40s"),
  t.Literal("50s"),
  t.Literal("60s"),
  t.Literal("70s"),
  t.Literal("80s"),
  t.Literal("90plus"),
  t.Literal("70plus"),
]);
/** "unspecified" is the answer "I'd rather not say". */
export const genderSchema = t.Union([t.Literal("female"), t.Literal("male"), t.Literal("other"), t.Literal("unspecified")]);
const _ageCovered: Exclude<(typeof userAgeRange.enumValues)[number], Static<typeof ageRangeSchema>> extends never ? true : never = true;
const _genderCovered: Exclude<(typeof userGender.enumValues)[number], Static<typeof genderSchema>> extends never ? true : never = true;
/** How they found the rally, asked after registering. */
export const foundViaSchema = t.Union([t.Literal("qr_or_sign"), t.Literal("flyer"), t.Literal("tourism_site"), t.Literal("sns"), t.Literal("search"), t.Literal("friend"), t.Literal("other")]);
const _foundViaCovered: Exclude<(typeof userFoundVia.enumValues)[number], Static<typeof foundViaSchema>> extends never ? true : never = true;
void [_ageCovered, _genderCovered, _foundViaCovered];

/** The accessibility and map choices (me/preferences.ts): the first five fields are required, nothing else is allowed. */
export const preferencesSchema = t.Object(
  {
    size: t.Union([t.Literal("small"), t.Literal("standard"), t.Literal("large"), t.Literal("xlarge")]),
    mergeStops: t.Boolean(),
    placesOnMap: t.Boolean(),
    setupDone: t.Boolean(),
    // Added later, so older phones that do not send them still work: left out means off.
    furigana: t.Optional(t.Boolean()),
    contrast: t.Optional(t.Boolean()),
    calm: t.Optional(t.Boolean()),
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
    originPlace: t.Optional(originPlaceSchema),
    locale: t.Optional(localeSchema),
  },
  { additionalProperties: false },
);

/** A `:id` path parameter that must be a UUID. */
export const uuidParams = t.Object({ id: t.String({ pattern: "^[0-9a-fA-F-]{36}$" }) });

type Words<F extends string> = TObject<{ [K in F]: TOptional<TUnion<[TString, TNull]>> }>;

/**
 * `translations`: the item's words in the other content languages ({ de: { name: "…" } }), each field up to its
 * length; null clears a field. Every language and field is optional (a change sends only what changed).
 */
export function translationsSchema<const F extends string>(maxLengths: Record<F, number>) {
  const words = t.Object(
    Object.fromEntries(Object.entries<number>(maxLengths).map(([f, max]) => [f, t.Optional(t.Union([t.String({ maxLength: max }), t.Null()]))])),
  ) as unknown as Words<F>;
  return t.Partial(t.Object(Object.fromEntries(EXTRA_LOCALES.map((l) => [l, words])) as Record<ExtraLocale, Words<F>>));
}

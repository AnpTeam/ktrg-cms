// The words of a route, place, rally, notice or banner live in a *_translations table, one row per language. The
// rest of the API sees Japanese and English flat (nameJa, nameEn ...) and the other content languages as one
// `translations` map ({ de: { name } }): these turn rows into those shapes and back.
import type { contentLocales } from "./schema";

/** A language content can be written in (content_locale). */
export type ContentLocale = (typeof contentLocales)[number];

const LOCALES = ["ja", "en"] as const satisfies readonly ContentLocale[];
const SUFFIX = { ja: "Ja", en: "En" } as const;
const isFlat = (l: ContentLocale): l is (typeof LOCALES)[number] => l === "ja" || l === "en";

/** The content languages besides Japanese and English (admin entry only for now; visitors see ja / en). */
export const EXTRA_LOCALES = ["de", "fr", "th", "es"] as const satisfies readonly ContentLocale[];
export type ExtraLocale = (typeof EXTRA_LOCALES)[number];
const isExtra = (l: string): l is ExtraLocale => (EXTRA_LOCALES as readonly string[]).includes(l);

/** Words in the other languages: language → field → text. In a change, null clears a field. */
export type Translations<F extends string> = Partial<Record<ExtraLocale, Partial<Record<F, string | null>>>>;
/** `name` → `{ nameJa, nameEn, translations }`: Japanese and English flat, the other languages in one map. */
export type Flat<F extends string> = { [K in F as `${K}Ja` | `${K}En`]: string | null } & { translations: Translations<F> };

type TextRow<F extends string> = { locale: ContentLocale } & { [K in F]: string | null };

/** Words to write: one entry per language, with only the fields that change. */
export type Texts<F extends string> = { locale: ContentLocale; values: Partial<Record<F, string | null>> }[];

/** Which text fields each owner has. */
export const ROUTE_TEXT = ["name", "description", "history", "access"] as const;
export const SPOT_TEXT = ["name", "description", "statusNote"] as const;
export const RALLY_TEXT = ["name"] as const;
export const NOTICE_TEXT = ["title", "body", "sourceName"] as const;
export const BANNER_TEXT = ["alt"] as const;

/** Every field null, no other languages: an owner with no translation rows. */
export function emptyTexts<F extends string>(fields: readonly F[]): Flat<F> {
  const out: Record<string, unknown> = { translations: {} };
  for (const f of fields) for (const l of LOCALES) out[f + SUFFIX[l]] = null;
  return out as Flat<F>;
}

/** Translation rows grouped by owner id, each flattened. */
export function flattenTexts<F extends string, R extends TextRow<F>>(
  fields: readonly F[],
  rows: readonly R[],
  ownerOf: (row: R) => string,
): Map<string, Flat<F>> {
  const out = new Map<string, Flat<F>>();
  for (const row of rows) {
    const id = ownerOf(row);
    const flat = (out.get(id) ?? emptyTexts(fields)) as unknown as Record<string, unknown> & { translations: Translations<F> };
    if (isFlat(row.locale)) {
      for (const f of fields) flat[f + SUFFIX[row.locale]] = row[f];
    } else if (isExtra(row.locale)) {
      // Another language: only the fields with text, and only if it has any.
      const words = Object.fromEntries(fields.flatMap((f) => (row[f] === null ? [] : [[f, row[f]]])));
      if (Object.keys(words).length > 0) flat.translations = { ...flat.translations, [row.locale]: words };
    }
    out.set(id, flat as unknown as Flat<F>);
  }
  return out;
}

/**
 * Splits flat values into the owner's own columns and one set of words per language that has any, the other
 * languages (`translations`) included. Undefined means "not changed" and is left out, as Drizzle would.
 */
export function splitTexts<F extends string, T extends object>(fields: readonly F[], values: T) {
  const { translations, ...plain } = values as Record<string, unknown> & { translations?: Translations<F> };
  const rest: Record<string, unknown> = plain;
  const texts: Texts<F> = [...extraToTexts(translations)];
  for (const locale of LOCALES) {
    const words: Partial<Record<F, string | null>> = {};
    for (const f of fields) {
      const key = f + SUFFIX[locale];
      if (rest[key] !== undefined) words[f] = rest[key] as string | null;
      delete rest[key];
    }
    if (Object.keys(words).length > 0) texts.push({ locale, values: words });
  }
  return { rest: rest as Omit<T, keyof Flat<F>>, texts };
}

/** A `translations` change as rows to write (the same update-then-insert the stores use for ja and en). */
export function extraToTexts<F extends string>(translations: Translations<F> | undefined): Texts<F> {
  return Object.entries(translations ?? {}).flatMap(([locale, values]) =>
    isExtra(locale) && values && Object.keys(values).length > 0 ? [{ locale, values: values as Partial<Record<F, string | null>> }] : [],
  );
}

/** Trimmed, blank as null (cleared), unknown languages dropped. */
export function cleanTranslations<F extends string>(translations: Translations<F> | undefined): Translations<F> | undefined {
  if (!translations) return undefined;
  const out: Translations<F> = {};
  for (const [locale, values] of Object.entries(translations)) {
    if (!isExtra(locale) || !values) continue;
    out[locale] = Object.fromEntries(Object.entries(values).map(([f, v]) => [f, typeof v === "string" && v.trim() !== "" ? v.trim() : null])) as Partial<Record<F, string | null>>;
  }
  return out;
}

/** A saved map with a change applied, as the database ends up (for the memory stores): null removes a field. */
export function mergeTranslations<F extends string>(saved: Translations<F> | undefined, change: Translations<F> | undefined): Translations<F> {
  const out: Translations<F> = { ...saved };
  for (const [locale, values] of Object.entries(change ?? {})) {
    if (!isExtra(locale) || !values) continue;
    const merged = Object.fromEntries(Object.entries({ ...out[locale], ...values }).filter(([, v]) => v !== null && v !== undefined));
    if (Object.keys(merged).length > 0) out[locale] = merged as Partial<Record<F, string>>;
    else delete out[locale];
  }
  return out;
}

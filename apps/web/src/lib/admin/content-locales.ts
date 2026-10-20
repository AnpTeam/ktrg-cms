// The languages an admin can write content in, besides Japanese (required). The visitor site still speaks only
// Japanese and English; the others are saved for later (CLAUDE.md, decisions 2026-10-20). Mirrors content_locale
// in the API (apps/api/src/db/translations.ts).

/** Languages kept in their own `translations` map ({ de: { name } }); English has its own fields (nameEn). */
export const EXTRA_LOCALES = ["de", "fr", "th", "es"] as const;
export type ExtraLocale = (typeof EXTRA_LOCALES)[number];
/** The languages a field can add, in menu order. */
export type AddedLocale = "en" | ExtraLocale;
export const ADDED_LOCALES: readonly AddedLocale[] = ["en", ...EXTRA_LOCALES];

/** Each language by its own name, so a speaker finds it whatever the admin's own language is. */
export const LOCALE_NAMES: Record<"ja" | AddedLocale, string> = {
  ja: "日本語",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  th: "ไทย",
  es: "Español",
};

/** At most this many boxes per field, Japanese included (the user's limit, 2026-10-20). */
export const MAX_LANGUAGES = 5;

/** Words in the other languages: language → field → text. In a change, null clears a field. */
export type Translations = Partial<Record<ExtraLocale, Partial<Record<string, string | null>>>>;

/** The added languages a field starts with: English and every other language that already has text, in menu order. */
export function startLanguages(en: string, translations: Translations | undefined, field: string): AddedLocale[] {
  return ADDED_LOCALES.filter((l) => (l === "en" ? en.trim() !== "" : (translations?.[l]?.[field] ?? "") !== ""));
}

/** What the "add" button would add next, or null when the field is full or every language is in use. */
export function nextLanguage(shown: readonly AddedLocale[]): AddedLocale | null {
  if (1 + shown.length >= MAX_LANGUAGES) return null;
  return ADDED_LOCALES.find((l) => !shown.includes(l)) ?? null;
}

/** The map with one field of one language set (null clears it), for the draft's state. */
export function withTranslation(translations: Translations | undefined, locale: ExtraLocale, field: string, value: string | null): Translations {
  return { ...translations, [locale]: { ...translations?.[locale], [field]: value } };
}

/**
 * What changed between two maps, as the API takes it (null clears a field); null when nothing did. Blank text
 * counts as cleared.
 */
export function translationsChange(saved: Translations | undefined, draft: Translations | undefined): Translations | null {
  const out: Translations = {};
  for (const locale of EXTRA_LOCALES) {
    const fields = new Set([...Object.keys(saved?.[locale] ?? {}), ...Object.keys(draft?.[locale] ?? {})]);
    for (const f of fields) {
      const before = saved?.[locale]?.[f]?.trim() || null;
      const after = draft?.[locale]?.[f]?.trim() || null;
      if (before !== after) out[locale] = { ...out[locale], [f]: after };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * A row's language changed (`to`) or the row was removed (`to` null): the text moves with it, and the old language
 * is cleared. English lives in its own field, the others in the map, so the answer gives both.
 */
export function moveLanguage(
  words: { en: string; translations: Translations },
  field: string,
  from: AddedLocale,
  to: AddedLocale | null,
): { en: string; translations: Translations } {
  const text = from === "en" ? words.en : (words.translations[from]?.[field] ?? "");
  let en = from === "en" ? "" : words.en;
  let translations = from === "en" ? words.translations : withTranslation(words.translations, from, field, null);
  if (to === "en") en = text;
  else if (to) translations = withTranslation(translations, to, field, text || null);
  return { en, translations };
}

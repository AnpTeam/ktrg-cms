// Single source of truth for supported locales. Kept free of Lingui and Next
// imports so the proxy, the Lingui CLI config and tests can all import it.
export const locales = ["ja", "en"] as const;
export type Locale = (typeof locales)[number];

/** Japanese is the source language and the final fallback. */
export const defaultLocale: Locale = "ja";

/** Remembers the visitor's choice until accounts exist (then users.locale wins). */
export const localeCookie = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.some((locale) => locale === value);
}

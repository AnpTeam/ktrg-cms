// Choosing the text for a language. Pure and free of content data, so client components may import it.

export interface Picked {
  text: string;
  lang: "ja" | "en";
  /** English was requested but only Japanese exists. */
  fallback: boolean;
}

/** The text for a locale: English if asked and entered, otherwise Japanese. */
export function pickText(locale: string, ja: string | null, en: string | null): Picked | null {
  if (locale === "en" && en) return { text: en, lang: "en", fallback: false };
  if (ja) return { text: ja, lang: "ja", fallback: locale === "en" };
  return null;
}

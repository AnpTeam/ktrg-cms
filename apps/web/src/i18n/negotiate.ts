import { defaultLocale, isLocale, type Locale } from "./locales";

/** First supported locale in an Accept-Language header, highest q first. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { primary: tag.trim().split("-")[0]?.toLowerCase() ?? "", weight, index };
    })
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map((entry) => entry.primary).find(isLocale);
}

/** Saved choice (cookie), then Accept-Language, then Japanese. */
export function pickLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? defaultLocale;
}

import { cookies, headers } from "next/headers";
import { setupI18n, type I18n, type Messages } from "@lingui/core";
import { setI18n } from "@lingui/react/server";
import { localeCookie, locales, type Locale } from "./locales";
import { pickLocale } from "./negotiate";

async function loadCatalog(locale: string): Promise<[string, Messages]> {
  const { messages } = await import(`../locales/${locale}.po`);
  return [locale, messages];
}

// Every catalog is loaded once, when the server starts.
const allMessages: Record<string, Messages> = Object.fromEntries(
  await Promise.all(locales.map(loadCatalog)),
);

// One I18n instance per locale: requests for different locales run
// concurrently on the server, so they must never share one instance.
const instances: Record<string, I18n> = Object.fromEntries(
  locales.map((locale) => [
    locale,
    setupI18n({ locale, messages: { [locale]: allMessages[locale] ?? {} } }),
  ]),
);

export function getI18nInstance(locale: Locale): I18n {
  return instances[locale] as I18n;
}

/**
 * The visitor's language: the saved choice (cookie), then Accept-Language,
 * then Japanese. The URL carries no language, so one address serves everyone
 * (and an installed phone app never leaves its own scope when the language changes).
 */
export async function requestLocale(): Promise<Locale> {
  return pickLocale({
    cookie: (await cookies()).get(localeCookie)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
}

/**
 * Makes the i18n instance for this request's language available to Server
 * Components. Call it first in every page, layout and generateMetadata.
 */
export async function initLingui() {
  const i18n = getI18nInstance(await requestLocale());
  setI18n(i18n);
  return i18n;
}

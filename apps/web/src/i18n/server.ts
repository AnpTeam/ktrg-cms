import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { setupI18n, type I18n, type Messages } from "@lingui/core";
import { setI18n } from "@lingui/react/server";
import { isLocale, locales } from "./locales";

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

export function getI18nInstance(locale: string | undefined): I18n {
  const i18n = isLocale(locale) ? instances[locale] : undefined;
  if (!i18n) notFound(); // the proxy only lets known locales through
  return i18n;
}

/**
 * Makes the i18n instance for the `[lang]` segment available to Server
 * Components for this request. Call it first in every page, layout and
 * generateMetadata.
 */
export async function initLingui() {
  const i18n = getI18nInstance(await lang());
  setI18n(i18n);
  return i18n;
}

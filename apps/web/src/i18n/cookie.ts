import { localeCookie, type Locale } from "./locales";

/** Remembers the visitor's language choice (browser only; not a secret). */
export function rememberLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

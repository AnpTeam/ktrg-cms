import { type NextRequest, NextResponse } from "next/server";
import { localeCookie, locales } from "./i18n/locales";
import { pickLocale } from "./i18n/negotiate";

// Redirects /foo to /ja/foo or /en/foo: saved choice, then Accept-Language,
// then Japanese. Paths that already carry a supported locale pass through.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = pickLocale({
    cookie: request.cookies.get(localeCookie)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  const response = NextResponse.redirect(url);
  response.headers.append("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Skip the API (rewritten to Elysia), Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};

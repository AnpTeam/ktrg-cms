import { type NextRequest, NextResponse } from "next/server";
import { localeCookie, locales } from "./i18n/locales";
import { pickLocale } from "./i18n/negotiate";
import { devViewerCookie } from "./lib/viewer";

// Redirects /foo to /ja/foo or /en/foo: saved choice, then Accept-Language,
// then Japanese. Paths that already carry a supported locale pass through.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) {
    // Development only: remember `?as=in` / `?as=out` so the signed-in and signed-out
    // screens can be reviewed while browsing. Production never reads or sets it.
    if (process.env.NODE_ENV === "production") return;
    const as = request.nextUrl.searchParams.get("as");
    if (as !== "in" && as !== "out" && as !== "auto") return;
    const response = NextResponse.next();
    if (as === "auto") response.cookies.delete(devViewerCookie);
    else response.cookies.set(devViewerCookie, as, { path: "/" });
    return response;
  }

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

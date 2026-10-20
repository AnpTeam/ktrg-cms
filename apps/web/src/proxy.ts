import { type NextRequest, NextResponse } from "next/server";
import { localeCookie, locales } from "./i18n/locales";
import { devViewerCookie } from "./lib/viewer";

// The address carries no language (the language lives in a cookie), so one set of
// addresses serves everyone and an installed phone app never leaves its own scope.
// Old links that still start with /ja or /en are sent to the same page without the
// prefix, and the prefix is kept as the visitor's language.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefix = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (prefix) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(prefix.length + 1) || "/";
    const response = NextResponse.redirect(url);
    response.cookies.set(localeCookie, prefix, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return response;
  }

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

export const config = {
  // Skip the API (rewritten to Elysia), Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};

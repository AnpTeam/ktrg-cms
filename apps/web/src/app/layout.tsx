import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LinguiClientProvider } from "@/i18n/LinguiClientProvider";
import { initLingui } from "@/i18n/server";
import { getPrefs } from "@/lib/server-prefs";
import { themeCookie, themeFromValue } from "@/lib/theme";
import "./globals.css";

// Colors match the paper token of each palette in globals.css.
// Pinch zoom is off (asked for on phones): the in-app text size setting replaces it, and the
// map keeps its own pinch. `globals.css` also sets touch-action on phone widths for browsers
// that ignore these two values.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // The page may draw under the notch and the status bar; globals.css covers it in the installed app.
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0908" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  const site = i18n._(msg`葛城修験`);
  // The tab title of a page with none of its own: the name plus what the site is. The Japanese stays just the name
  // (the context keeps it a separate message from the plain name above).
  const home = i18n._(msg({ message: "葛城修験", context: "tab title" }));
  // What search results and link previews show. No numbers here: counts live in the content, not in code.
  const description = i18n._(msg`大阪・和歌山・奈良にまたがる、葛城修験の山の古道を歩くための道案内とスタンプラリーです。`);
  return {
    title: { default: home, template: `%s | ${site}` },
    description,
    openGraph: { type: "website", siteName: site, title: home, description },
    // Added to the iPhone's home screen it opens like an app; the page runs under the status bar (globals.css draws a dark strip there, and the map shows through).
    appleWebApp: { capable: true, title: site, statusBarStyle: "black-translucent" },
  };
}

// The document shell only. Each route group ((public), later (staff) and
// (admin)) brings its own header, <main id="main"> and navigation.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  // The visitor's Light or Dark choice, written into the HTML so the first paint is already right.
  // Reading the cookie makes pages render per request; that is the price of no flash and no script.
  const theme = themeFromValue((await cookies()).get(themeCookie)?.value);
  // The text and component size the visitor chose, written the same way.
  const { size, contrast, calm, furigana } = await getPrefs();

  return (
    <html lang={i18n.locale} data-theme={theme === "auto" ? undefined : theme} data-size={size} data-contrast={contrast ? "" : undefined} data-calm={calm ? "" : undefined} data-furigana={furigana ? "" : undefined}>
      <body>
        <LinguiClientProvider initialLocale={i18n.locale} initialMessages={i18n.messages}>
          <a
            href="#main"
            className="tap-target sr-only rounded-lg bg-ink px-4 text-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:inline-flex focus:items-center"
          >
            <Trans>本文へ移動</Trans>
          </a>
          {children}
        </LinguiClientProvider>
      </body>
    </html>
  );
}

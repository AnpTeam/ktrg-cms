import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LinguiClientProvider } from "@/i18n/LinguiClientProvider";
import { locales } from "@/i18n/locales";
import { initLingui } from "@/i18n/server";
import { themeCookie, themeFromValue } from "@/lib/theme";
import "../globals.css";

// Colors match the paper token of each palette in globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1311" },
  ],
};

// Pre-render every page in every supported locale at build time.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  const site = i18n._(msg`葛城修験`);
  return { title: { default: site, template: `%s | ${site}` } };
}

// The document shell only. Each route group ((public), later (staff) and
// (admin)) brings its own header, <main id="main"> and navigation.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  // The visitor's Light or Dark choice, written into the HTML so the first paint is already right.
  // Reading the cookie makes pages render per request; that is the price of no flash and no script.
  const theme = themeFromValue((await cookies()).get(themeCookie)?.value);

  return (
    <html lang={i18n.locale} data-theme={theme === "auto" ? undefined : theme}>
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

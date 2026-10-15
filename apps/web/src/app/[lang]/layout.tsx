import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LinguiClientProvider } from "@/i18n/LinguiClientProvider";
import { locales } from "@/i18n/locales";
import { initLingui } from "@/i18n/server";
import "../globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Pre-render every page in every supported locale at build time.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`葛城修験`) };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();

  return (
    <html lang={i18n.locale}>
      <body>
        <LinguiClientProvider initialLocale={i18n.locale} initialMessages={i18n.messages}>
          <a
            href="#main"
            className="tap-target sr-only rounded-lg bg-ink px-4 text-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:inline-flex focus:items-center"
          >
            <Trans>本文へ移動</Trans>
          </a>
          <header className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-4">
            <p className="text-lg font-bold">
              <Trans>葛城修験</Trans>
            </p>
            <LocaleSwitcher />
          </header>
          <main id="main">{children}</main>
        </LinguiClientProvider>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { rememberLocale } from "@/i18n/cookie";
import { locales, type Locale } from "@/i18n/locales";

// Endonyms on purpose: each language names itself, so it is findable even
// when the page is in a language the visitor cannot read.
const names: Record<Locale, string> = { ja: "日本語", en: "English" };

export function LocaleSwitcher() {
  const { t, i18n } = useLingui();
  const pathname = usePathname() ?? "/";

  // /ja/routes -> /en/routes: swap the first segment, keep the rest.
  const hrefFor = (locale: Locale) => {
    const [, , ...rest] = pathname.split("/");
    return `/${[locale, ...rest].join("/")}`;
  };

  return (
    <nav aria-label={t`言語`} className="flex gap-1.5">
      {locales.map((locale) => {
        const active = locale === i18n.locale;
        return (
          <Link
            key={locale}
            href={hrefFor(locale)}
            lang={locale}
            hrefLang={locale}
            aria-current={active ? "true" : undefined}
            onClick={() => rememberLocale(locale)}
            className={`inline-flex min-h-10 min-w-16 items-center justify-center rounded-lg border-2 border-ink px-2.5 text-base font-bold ${
              active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"
            }`}
          >
            {names[locale]}
          </Link>
        );
      })}
    </nav>
  );
}

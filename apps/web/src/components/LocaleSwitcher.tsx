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
    <nav aria-label={t`言語`} className="flex gap-2">
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
            className={`inline-flex min-h-12 min-w-24 items-center justify-center rounded-lg border-2 px-4 text-lg font-bold ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-100"
            }`}
          >
            {names[locale]}
          </Link>
        );
      })}
    </nav>
  );
}

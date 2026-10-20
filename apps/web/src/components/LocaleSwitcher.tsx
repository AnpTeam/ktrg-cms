"use client";

import { useRouter } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { rememberLocale } from "@/i18n/cookie";
import { locales, type Locale } from "@/i18n/locales";

// Endonyms on purpose: each language names itself, so it is findable even
// when the page is in a language the visitor cannot read.
const names: Record<Locale, string> = { ja: "日本語", en: "English" };

// The language is a cookie, not part of the address: choosing one saves it and
// re-renders the same page in place. No navigation happens, so an installed phone app
// stays in its own window instead of opening a browser sheet over itself.
export function LocaleSwitcher() {
  const { t, i18n } = useLingui();
  const router = useRouter();

  return (
    <nav aria-label={t`言語`} className="flex gap-1.5">
      {locales.map((locale) => {
        const active = locale === i18n.locale;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-current={active ? "true" : undefined}
            onClick={() => {
              if (active) return;
              rememberLocale(locale);
              router.refresh();
            }}
            className={`inline-flex min-h-10 min-w-16 items-center justify-center rounded-lg border border-ink px-2.5 text-base font-bold ${
              active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"
            }`}
          >
            {names[locale]}
          </button>
        );
      })}
    </nav>
  );
}

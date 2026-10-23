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

/**
 * The same choice as a drop-down, small enough for the menu's top row (next to its close button), so the language is
 * always one tap away without a block of its own inside the menu.
 */
export function LocaleSelect() {
  const { t, i18n } = useLingui();
  const router = useRouter();
  return (
    <select
      aria-label={t`言語`}
      value={i18n.locale}
      onChange={(e) => {
        const next = e.target.value as Locale;
        if (next === i18n.locale) return;
        rememberLocale(next);
        router.refresh();
      }}
      className="min-h-11 rounded-lg border border-ink bg-paper px-2.5 text-base font-bold text-ink hover:bg-surface"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale} lang={locale}>
          {names[locale]}
        </option>
      ))}
    </select>
  );
}

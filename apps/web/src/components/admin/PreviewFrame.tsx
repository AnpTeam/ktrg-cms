"use client";

import { useState, type ReactNode } from "react";
import { setupI18n, type I18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useLingui } from "@lingui/react/macro";

/**
 * A phone-shaped frame around a page drawn from what is being typed. It starts in the language the admin is using and the
 * button offers the other one. The page's own labels follow the frame's language too, so Japanese text is never shown with
 * English labels (or the other way round).
 */
export function PreviewFrame({ locale: adminLocale, canWiden = true, sideBySide = false, plain = false, extra, children }: { locale: string; canWiden?: boolean; /** The frame sits in a narrow column from 2xl up, where a wider frame cannot show: the width button is hidden there. */ sideBySide?: boolean; /** No phone frame: the page runs the full width, as a visitor sees it. */ plain?: boolean; /** More buttons beside the language button. */ extra?: ReactNode; children: (locale: "ja" | "en") => ReactNode }) {
  const { t } = useLingui();
  const adminLang = adminLocale === "en" ? "en" : "ja";
  const [locale, setLocale] = useState<"ja" | "en">(adminLang);
  // The page's own words in the other language (loaded when first asked for); in the admin's own language the admin's words are used.
  const [otherI18n, setOtherI18n] = useState<I18n | null>(null);
  const [wide, setWide] = useState(false);
  const toggleLanguage = async () => {
    const next = locale === "en" ? "ja" : "en";
    if (next !== adminLang && !otherI18n) {
      const { messages } = await import(`../../locales/${next}.po`);
      setOtherI18n(setupI18n({ locale: next, messages: { [next]: messages } }));
    }
    setLocale(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-base font-bold">{t`プレビュー`}</p>
        {/* The button names the language it switches to (a language's own name, never translated). */}
        <button type="button" onClick={toggleLanguage} lang={locale === "en" ? "ja" : "en"} className="rounded-full bg-surface px-3 py-2.5 text-sm font-bold">
          {locale === "en" ? "日本語" : "English"}
        </button>
        {extra}
        {canWiden ? (
          <button type="button" aria-pressed={wide} onClick={() => setWide(!wide)} className={`rounded-full bg-surface px-3 py-2.5 text-sm font-bold aria-pressed:bg-selected aria-pressed:text-on-selected ${sideBySide ? "2xl:hidden" : ""}`}>
            {t`パソコン幅`}
          </button>
        ) : null}
      </div>
      {plain ? (
        <div className="relative flex flex-col overflow-x-clip rounded-2xl border border-line bg-paper" data-testid="live-preview">
          {locale !== adminLang && otherI18n ? <I18nProvider i18n={otherI18n}>{children(locale)}</I18nProvider> : children(locale)}
        </div>
      ) : (
      <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[26rem]"} overflow-hidden bg-paper ${sideBySide ? "border border-line 2xl:rounded-[2rem] 2xl:border-4 2xl:border-ink 2xl:shadow-sm" : "rounded-[2rem] border-4 border-ink shadow-sm"}`}>
        <div className="relative flex max-h-[min(44rem,calc(100dvh-14rem))] flex-col gap-6 overflow-y-auto overflow-x-hidden py-6" data-testid="live-preview">
          {locale !== adminLang && otherI18n ? <I18nProvider i18n={otherI18n}>{children(locale)}</I18nProvider> : children(locale)}
        </div>
      </div>
      )}
    </div>
  );
}

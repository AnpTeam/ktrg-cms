"use client";

import { useDeferredValue, useState } from "react";
import { setupI18n, type I18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useLingui } from "@lingui/react/macro";
import { RouteView } from "@/components/RouteView";
import { previewRoute, type RouteDraft } from "@/lib/admin/route-draft";
import { defaultMapSettings } from "@/lib/map-settings";

/**
 * The route page as a visitor will see it, drawn from what is being typed (not from what is saved). It is the same
 * RouteView the public page uses, in a phone-width frame. Drafts show here even though visitors will not see them yet.
 */
export function LivePreview({ draft, order, locale: adminLocale }: { draft: RouteDraft; order: number; locale: string }) {
  const { t } = useLingui();
  // The frame starts in the language the admin is using; the button offers the other one. The page's own labels follow the frame's
  // language too, so a Japanese route is never shown with English labels (or the other way round).
  const adminLang = adminLocale === "en" ? "en" : "ja";
  const [locale, setLocale] = useState<"ja" | "en">(adminLang);
  // The page's own words in the other language (loaded when first asked for); in the admin's own language the admin's words are used.
  const [otherI18n, setOtherI18n] = useState<I18n | null>(null);
  const toggleLanguage = async () => {
    const next = locale === "en" ? "ja" : "en";
    if (next !== adminLang && !otherI18n) {
      const { messages } = await import(`../../locales/${next}.po`);
      setOtherI18n(setupI18n({ locale: next, messages: { [next]: messages } }));
    }
    setLocale(next);
  };
  const [wide, setWide] = useState(false);
  // Typing stays quick: the preview catches up a moment later.
  const shown = useDeferredValue(draft);
  const route = previewRoute(shown, order);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-base font-bold">{t`プレビュー`}</p>
        {/* The button names the language it switches to (a language's own name, never translated). */}
        <button type="button" onClick={toggleLanguage} lang={locale === "en" ? "ja" : "en"} className="rounded-full bg-surface px-3 py-1 text-sm font-bold">
          {locale === "en" ? "日本語" : "English"}
        </button>
        <button type="button" aria-pressed={wide} onClick={() => setWide(!wide)} className="rounded-full bg-surface px-3 py-1 text-sm font-bold aria-pressed:bg-brand aria-pressed:text-on-brand">
          {t`パソコン幅`}
        </button>
      </div>
      <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[26rem]"} overflow-hidden rounded-[2rem] border-4 border-ink bg-paper shadow-sm`}>
        <div className="relative flex max-h-[min(44rem,calc(100dvh-14rem))] flex-col gap-6 overflow-y-auto overflow-x-hidden py-6" data-testid="live-preview">
          {locale !== adminLang && otherI18n ? (
            <I18nProvider i18n={otherI18n}>
              <PreviewBody route={route} locale={locale} />
            </I18nProvider>
          ) : (
            <PreviewBody route={route} locale={locale} />
          )}
        </div>
      </div>
      <p className="text-base text-muted">{t`公開前の経由地も、ここには表示されます。`}</p>
    </div>
  );
}

// Its own component so the labels are translated by whichever language provider it sits in.
function PreviewBody({ route, locale }: { route: ReturnType<typeof previewRoute>; locale: string }) {
  const { t } = useLingui();
  return (
    <RouteView
      route={route}
      locale={locale}
      places={[]}
      settings={defaultMapSettings}
      mergeStops={false}
      placesFirst={false}
      labels={{ stamped: t`スタンプ済み`, closed: t`閉鎖中`, start: t`スタート`, goal: t`ゴール` }}
      spotHref={() => "#"}
    />
  );
}

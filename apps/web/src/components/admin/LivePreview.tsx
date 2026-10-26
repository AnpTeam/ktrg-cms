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
  // Which language's texts (and which width) the frame shows. The page's own labels follow it too.
  const [english, setEnglish] = useState(false);
  // The page's own words in English too, so the frame shows what an English visitor sees (loaded when first asked for).
  const [enI18n, setEnI18n] = useState<I18n | null>(null);
  const toggleEnglish = async () => {
    if (!english && !enI18n) {
      const { messages } = await import(`../../locales/${"en"}.po`);
      setEnI18n(setupI18n({ locale: "en", messages: { en: messages } }));
    }
    setEnglish(!english);
  };
  const [wide, setWide] = useState(false);
  const locale = english ? "en" : adminLocale === "en" ? "ja" : adminLocale;
  // Typing stays quick: the preview catches up a moment later.
  const shown = useDeferredValue(draft);
  const route = previewRoute(shown, order);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-base font-bold">{t`プレビュー`}</p>
        <button type="button" aria-pressed={english} onClick={toggleEnglish} className="rounded-full bg-surface px-3 py-1 text-sm font-bold aria-pressed:bg-brand aria-pressed:text-on-brand">
          English
        </button>
        <button type="button" aria-pressed={wide} onClick={() => setWide(!wide)} className="rounded-full bg-surface px-3 py-1 text-sm font-bold aria-pressed:bg-brand aria-pressed:text-on-brand">
          {t`パソコン幅`}
        </button>
      </div>
      <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[26rem]"} overflow-hidden rounded-[2rem] border-4 border-ink bg-paper shadow-sm`}>
        <div className="flex max-h-[min(44rem,calc(100dvh-14rem))] flex-col gap-6 overflow-y-auto overflow-x-hidden py-6" data-testid="live-preview">
          {english && enI18n ? (
            <I18nProvider i18n={enI18n}>
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

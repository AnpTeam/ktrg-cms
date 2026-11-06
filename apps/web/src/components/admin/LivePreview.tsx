"use client";

import { useDeferredValue } from "react";
import { useLingui } from "@lingui/react/macro";
import { RouteView } from "@/components/RouteView";
import { previewRoute, type RouteDraft } from "@/lib/admin/route-draft";
import { defaultMapSettings } from "@/lib/map-settings";
import { PreviewFrame } from "./PreviewFrame";

/**
 * The route page as a visitor will see it, drawn from what is being typed (not from what is saved). It is the same
 * RouteView the public page uses, in a phone-width frame. Drafts show here even though visitors will not see them yet.
 */
export function LivePreview({ draft, order, locale }: { draft: RouteDraft; order: number; locale: string }) {
  const { t } = useLingui();
  // Typing stays quick: the preview catches up a moment later.
  const shown = useDeferredValue(draft);
  const route = previewRoute(shown, order);

  return (
    <div className="flex flex-col gap-2">
      <PreviewFrame locale={locale}>{(lang) => <PreviewBody route={route} locale={lang} />}</PreviewFrame>
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

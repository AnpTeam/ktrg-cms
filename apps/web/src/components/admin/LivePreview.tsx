"use client";

import { useDeferredValue } from "react";
import { useLingui } from "@lingui/react/macro";
import { RouteView } from "@/components/RouteView";
import { previewRoute, type RouteDraft } from "@/lib/admin/route-draft";
import { defaultMapSettings } from "@/lib/map-settings";

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
      <p className="text-base font-bold">{t`プレビュー`}</p>
      <div className="mx-auto w-full max-w-[26rem] overflow-hidden rounded-[2rem] border-4 border-ink bg-paper shadow-sm">
        <div className="flex max-h-[44rem] flex-col gap-6 overflow-y-auto overflow-x-hidden py-6" data-testid="live-preview">
          <RouteView
            route={route}
            locale={locale}
            places={[]}
            settings={defaultMapSettings}
            mergeStops={false}
            placesFirst={false}
            labels={{ stamped: t`スタンプ済み`, closed: t`閉鎖中` }}
            spotHref={() => "#"}
          />
        </div>
      </div>
      <p className="text-base text-muted">{t`公開前の経由地も、ここには表示されます。`}</p>
    </div>
  );
}

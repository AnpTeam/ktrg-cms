import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import type { RouteDetail } from "@/lib/content";
import type { Journey, TrailStop } from "@/lib/route-stops";
import { Localized } from "./Localized";
import { RouteStats } from "./RouteStats";
import { StartGoalWords, stopName, WalkStyleChip } from "./RouteJourney";

function Line({ badge, stop, locale, goal = false, both = false }: { badge: ReactNode; stop: TrailStop; locale: string; goal?: boolean; both?: boolean }) {
  return (
    <p className="flex items-center gap-2 text-xl font-bold leading-snug">
      <span className={`badge-ruri badge-small shrink-0 ${goal ? "badge-goal" : both ? "badge-both" : ""}`}>{badge}</span>
      <span className="min-w-0">
        <Localized value={stopName(stop, locale)} />
      </span>
    </p>
  );
}

/**
 * The route in one card for a phone: where it starts and ends (the same blue Start and orange Goal badges as the access
 * section, smaller), how it is walked, the numbers, and how many stamps. It is only drawn when the page is narrow (the wide
 * page shows the same facts in its header), and it sits right above the map.
 */
export function TripSummary({ route, journey, locale }: { route: RouteDetail; journey: Journey | null; locale: string }) {
  const { stampedCount, spotCount } = route;
  if (!journey && spotCount === 0 && route.distanceKm === null && route.expectedTimeMin === null) return null;
  const style = journey?.style ?? null;
  // A walk that comes back to its start names the start once; one that ends elsewhere names both.
  const startOnly = style === "loop" || style === "out_and_back";
  return (
    <section className="frame pattern-shippo mx-4 p-4 @4xl:hidden">
      {journey ? (
        <div className="flex flex-col gap-2">
          <Line badge={startOnly ? <StartGoalWords /> : <Trans>スタート</Trans>} stop={journey.start} locale={locale} both={startOnly} />
          {!startOnly && journey.goal ? <Line badge={<Trans>ゴール</Trans>} stop={journey.goal} locale={locale} goal /> : null}
          {style === "out_and_back" && journey.turnaround ? <Line badge={<Trans>折り返し</Trans>} stop={journey.turnaround} locale={locale} goal /> : null}
          {style ? (
            <p>
              <WalkStyleChip style={style} className="text-base" />
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3">
        <RouteStats route={route} compact />
      </div>
      {spotCount > 0 ? (
        <p className="mt-3 text-lg font-bold tabular-nums">
          {stampedCount !== null ? (
            <Trans>
              スタンプ {stampedCount} / {spotCount}
            </Trans>
          ) : (
            <Trans>スタンプの場所 {spotCount}か所</Trans>
          )}
        </p>
      ) : null}
    </section>
  );
}

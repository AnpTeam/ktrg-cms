import { Trans } from "@lingui/react/macro";
import type { RouteDetail } from "@/lib/content";
import type { Journey } from "@/lib/route-stops";
import { Localized } from "./Localized";
import { RouteStats } from "./RouteStats";
import { stopName, WalkStyleChip } from "./RouteJourney";

/**
 * The route in one card for a phone: where it starts and ends, the numbers, and how many stamps. It is only drawn when the
 * page is narrow (the wide page shows the same facts in its header), and it sits right above the map.
 */
export function TripSummary({ route, journey, locale }: { route: RouteDetail; journey: Journey | null; locale: string }) {
  const { stampedCount, spotCount } = route;
  if (!journey && spotCount === 0 && route.distanceKm === null && route.expectedTimeMin === null) return null;
  // A walk that comes back to its start names the start once; one that ends elsewhere shows start → goal.
  const goalShown = journey?.goal && (journey.style === "one_way" || journey.style === null);
  return (
    <section className="frame pattern-shippo mx-4 p-4 @4xl:hidden">
      {journey ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold leading-snug">
          <Localized value={stopName(journey.start, locale)} />
          {goalShown && journey.goal ? (
            <>
              <span aria-hidden="true">→</span>
              <Localized value={stopName(journey.goal, locale)} />
            </>
          ) : null}
          {journey.style ? <WalkStyleChip style={journey.style} className="text-base" /> : null}
        </p>
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

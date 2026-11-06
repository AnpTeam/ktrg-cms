import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RouteSummary } from "@/lib/content";
import { TOTAL_ROUTES } from "@/lib/rally";
import { Coin } from "./MedalRow";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";

type PillRoute = Pick<
  RouteSummary,
  "order" | "status" | "spotCount" | "stampedCount" | "distanceKm" | "elevationGainM" | "expectedTimeMin" | "difficulty" | "physicalLevel" | "technicalLevel"
>;

/**
 * A course as one wide row (the user's design, 2026-11-06): its number out of all the courses, where it is, its name and
 * numbers on the left, its photo fading in from the right. Narrow, it keeps only distance and time; `brief` drops the place too, for the map's list.
 * The words stay on the plain part and the photo's faded edge, so they read on any photo.
 */
export function RoutePill({ route, name, place, photo, brief = false }: { route: PillRoute; name: ReactNode; place: ReactNode; photo: string | null; brief?: boolean }) {
  const { t } = useLingui();
  const { order, spotCount, stampedCount } = route;
  const soon = route.status === "soon";
  const total = TOTAL_ROUTES;
  const done = stampedCount !== null && spotCount > 0 && stampedCount >= spotCount;

  return (
    <span className="@container relative block overflow-hidden rounded-[1.75rem] bg-surface">
      <span className="absolute inset-y-0 right-0 block w-1/3 overflow-hidden @2xl:w-1/2">
        {/* A course that is not ready shows its photo blurred (the scale hides the soft edge), as in the course list. */}
        <span className={`absolute inset-0 block ${soon ? "scale-110 blur-[6px] saturate-50" : ""}`}>
          <RoutePhoto src={photo} alt="" />
        </span>
        <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-surface from-20% to-transparent to-85% @2xl:from-0% @2xl:to-70%" />
      </span>
      <span className="relative flex items-center gap-3 p-3 pr-[22%] @2xl:gap-4 @2xl:p-4 @2xl:pr-[38%]">
        <span aria-hidden="true" className={`badge-pattern flex w-11 shrink-0 flex-col rounded-lg py-1 text-center text-lg font-bold leading-tight tabular-nums ${soon ? "bg-line/25 text-muted" : "bg-brand text-on-brand"}`}>
          <span>{order}</span>
          <span className={`mx-2 h-px ${soon ? "bg-muted" : "bg-on-brand"}`} />
          <span>{total}</span>
        </span>
        <span className="sr-only">{t`${order} / ${total}`}</span>
        <span className="min-w-0">
          {place && !brief ? <span className="block text-base leading-snug text-muted">{place}</span> : null}
          <span className={`block text-xl font-bold leading-snug @2xl:text-2xl ${soon ? "text-muted" : "text-ink"}`}>{name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-base leading-snug text-ink">
            {soon ? (
              <span className="font-bold text-muted">{t`準備中`}</span>
            ) : (
              <>
                <RouteStats route={route} inline tips={false} />
                {spotCount > 0 ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Coin earned={done} size={20} />
                    <span className="sr-only">{stampedCount === null ? t`スタンプ場所 ${spotCount}か所` : t`スタンプ ${stampedCount} / ${spotCount}`}</span>
                    <span aria-hidden="true">{stampedCount === null ? t`${spotCount}個` : `${stampedCount} / ${spotCount}`}</span>
                  </span>
                ) : null}
              </>
            )}
          </span>
        </span>
      </span>
    </span>
  );
}

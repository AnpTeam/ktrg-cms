import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RouteSummary } from "@/lib/content";
import { Medal } from "./Medal";
import { Coin } from "./MedalRow";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";

type PillRoute = Pick<
  RouteSummary,
  "order" | "status" | "spotCount" | "stampedCount" | "distanceKm" | "elevationGainM" | "expectedTimeMin" | "difficulty" | "physicalLevel" | "technicalLevel"
>;

/**
 * A course as one wide row (the user's design, 2026-11-06): where it is, its name and numbers on the left, its photo fading
 * in from the right, with its number at the top right and its stamps at the bottom right, on the photo. Narrow, it keeps only
 * distance and time; `brief` drops the place too, for the map's list (not for a course not ready, which has no numbers).
 */
export function RoutePill({ route, name, place, photo, brief = false }: { route: PillRoute; name: ReactNode; place: ReactNode; photo: string | null; brief?: boolean }) {
  const { t } = useLingui();
  const { order, spotCount, stampedCount } = route;
  const soon = route.status === "soon";

  return (
    <span className="@container relative block overflow-hidden rounded-[1.75rem] bg-surface">
      <span className="absolute inset-y-0 right-0 block w-2/5 overflow-hidden @2xl:w-1/2">
        {/* A course that is not ready shows its photo blurred (the scale hides the soft edge), as in the course list. */}
        <span className={`absolute inset-0 block ${soon ? "scale-110 blur-[6px] saturate-50" : ""}`}>
          <RoutePhoto src={photo} alt="" />
        </span>
        <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-surface from-20% to-transparent to-85%" />
      </span>
      <span className="relative flex min-h-24 flex-col justify-center py-3 pl-4 pr-[34%] @2xl:py-4 @2xl:pl-5 @2xl:pr-[38%]">
        {!brief || soon ? (
          <span className="flex flex-wrap items-center gap-x-2 text-base leading-snug text-muted">
            {place ? <span>{place}</span> : null}
            {soon ? <span className="rounded-full bg-line/25 px-2 text-sm font-bold">{t`準備中`}</span> : null}
          </span>
        ) : null}
        <span className={`block text-xl font-bold leading-snug @2xl:text-2xl ${soon ? "text-muted" : "text-ink"}`}>{name}</span>
        {soon ? null : (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-base leading-snug text-ink">
            <RouteStats route={route} inline tips={false} />
          </span>
        )}
      </span>
      <span className={`badge-pattern absolute right-3 top-3 grid size-8 place-items-center rounded-full text-lg font-bold tabular-nums @2xl:size-7 ${soon ? "bg-line/25 text-muted" : "bg-brand text-on-brand"}`}>
        {order}
      </span>
      {!soon && spotCount > 0 ? (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-paper/90 px-1.5 py-0.5 tabular-nums text-ink">
          <span className="sr-only">{stampedCount === null ? t`スタンプ場所 ${spotCount}か所` : t`スタンプ ${stampedCount} / ${spotCount}`}</span>
          {stampedCount === null ? (
            <>
              <Coin earned={false} size={20} />
              <span aria-hidden="true" className="text-base">
                {spotCount}
              </span>
            </>
          ) : (
            <>
              <Medal number={order} done={stampedCount >= spotCount} stamped={stampedCount} total={spotCount} showNumber={false} className="size-6 shrink-0" />
              <span aria-hidden="true" className="text-sm">
                {stampedCount}/{spotCount}
              </span>
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}

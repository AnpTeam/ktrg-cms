import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { PointKindName } from "@/components/PointKindName";
import { RoutePhoto } from "@/components/RoutePhoto";
import type { RouteSummary, SpotDetail } from "@/lib/content";
import { pickText } from "@/lib/pick-text";

const card = "group flex overflow-hidden rounded-3xl bg-surface hover:bg-paper";

/** The route a post is about, as a card: its photo, name, length and climb, and a link to it. */
export function RouteCard({ route, locale }: { route: RouteSummary; locale: string }) {
  const name = pickText(locale, route.nameJa, route.nameEn);
  return (
    <Link href={`/routes/${route.id}`} className={card}>
      <span className="relative block w-28 shrink-0 sm:w-40">
        <RoutePhoto src={route.photoUrl} alt={name?.text ?? ""} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="text-base text-muted">
          <Trans>ルート {route.order}</Trans>
        </span>
        <span className="text-xl font-bold leading-snug text-accent group-hover:underline">
          <Localized value={name} />
        </span>
        <span className="text-base text-muted">
          {route.distanceKm !== null ? <Trans>{route.distanceKm}km</Trans> : null}
          {route.distanceKm !== null && route.elevationGainM !== null ? "　" : null}
          {route.elevationGainM !== null ? <Trans>のぼり {route.elevationGainM}m</Trans> : null}
        </span>
      </span>
      <span className="grid shrink-0 place-items-center pr-3 text-muted">
        <ChevronIcon />
      </span>
    </Link>
  );
}

/** The waypoint or sutra mound a post is about, as a card with a link to its page. */
export function SpotCard({ spot, locale }: { spot: SpotDetail; locale: string }) {
  const name = pickText(locale, spot.nameJa, spot.nameEn);
  const route = pickText(locale, spot.routeNameJa, spot.routeNameEn);
  return (
    <Link href={`/spots/${spot.id}`} className={card}>
      <span className="relative block w-28 shrink-0 sm:w-40">
        <RoutePhoto src={spot.photoUrl} alt={name?.text ?? ""} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="text-base text-muted">{spot.kind ? <PointKindName kind={spot.kind} /> : null}</span>
        <span className="text-xl font-bold leading-snug text-accent group-hover:underline">
          <Localized value={name} />
        </span>
        <span className="text-base text-muted">
          <Localized value={route} />
        </span>
      </span>
      <span className="grid shrink-0 place-items-center pr-3 text-muted">
        <ChevronIcon />
      </span>
    </Link>
  );
}

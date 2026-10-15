import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { pickText, type RouteSummary } from "@/lib/content";
import { ChevronIcon } from "./icons";
import { Localized } from "./Localized";
import { PrefectureName } from "./PrefectureName";
import { RouteStats } from "./RouteStats";

/** One route in the list: name, area, stats, and how many stamps are held. A full-width row, not a card. */
export function RouteRow({ route, href, locale }: { route: RouteSummary; href: string; locale: string }) {
  const { spotCount, stampedCount } = route;
  return (
    <Link
      href={href}
      className="tap-target flex items-center justify-between gap-4 border-y-2 border-line px-4 py-5 hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block text-xl font-bold">
          <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
        </span>
        {route.prefecture || route.municipality ? (
          <span className="mt-1 block text-lg text-muted">
            {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
            {route.prefecture && route.municipality ? " " : null}
            {route.municipality}
          </span>
        ) : null}
        <RouteStats route={route} />
        {spotCount > 0 ? (
          <span className="mt-3 block text-lg font-bold">
            {stampedCount === null ? (
              <Trans>スタンプ場所 {spotCount}か所</Trans>
            ) : (
              <Trans>
                スタンプ {stampedCount} / {spotCount}
              </Trans>
            )}
          </span>
        ) : null}
      </span>
      <span className="shrink-0">
        <ChevronIcon />
      </span>
    </Link>
  );
}

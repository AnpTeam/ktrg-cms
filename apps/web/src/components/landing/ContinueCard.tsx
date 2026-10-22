import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { pickText, type RouteSummary, type SpotListItem } from "@/lib/content";

/**
 * "Would you like to go on?": the course the visitor is part-way through (or the first one, for someone who has not
 * started) with the next places to stamp on it, each a link to the place's own page.
 */
export function ContinueCard({ route, next, locale }: { route: RouteSummary; next: SpotListItem[]; locale: string }) {
  const { stampedCount, spotCount } = route;
  const started = (stampedCount ?? 0) > 0;
  return (
    <section className="pattern-shippo mx-4 rounded-3xl bg-surface p-5">
      <h2 className="text-2xl font-bold">{started ? <Trans>続きを歩きませんか？</Trans> : <Trans>はじめの道を歩きませんか？</Trans>}</h2>
      <p className="mt-2 text-xl font-bold leading-snug">
        <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
      </p>
      {stampedCount !== null && spotCount > 0 ? (
        <p className="mt-1 text-lg font-bold tabular-nums">
          <Trans>
            スタンプ {stampedCount} / {spotCount}
          </Trans>
        </p>
      ) : null}
      {next.length > 0 ? (
        <>
          <p className="mt-4 text-lg text-muted">
            <Trans>つぎの場所</Trans>
          </p>
          <ul className="mt-1">
            {next.map((spot) => (
              <li key={spot.id}>
                <Link href={`/spots/${spot.id}`} className="tap-target flex items-center justify-between gap-3 border-t border-line/30 py-2 text-xl font-bold">
                  <span className="min-w-0">
                    <Localized value={pickText(locale, spot.nameJa, spot.nameEn)} tag={false} />
                  </span>
                  <span className="shrink-0 text-muted">
                    <ChevronIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="mt-4">
        <ButtonLink href={`/routes/${route.id}`}>
          <Trans>この道を見る</Trans>
        </ButtonLink>
      </div>
    </section>
  );
}

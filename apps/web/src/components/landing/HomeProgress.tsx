import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { StampGrid } from "@/components/StampGrid";
import { pickText, type RouteSummary, type SpotListItem } from "@/lib/content";
import { offersNoStamp } from "@/lib/spot-status";

const link = "tap-target inline-flex items-center gap-1 font-bold underline underline-offset-4 tabular-nums";

/**
 * A signed-in visitor's home, under the greeting (docs/design-language.md, phase 2): a sentence before any number. The
 * course to go on with, its next place large as the one thing to tap, the seals of that course as a strip, and the
 * counts as one line of plain links instead of a ring and tiles. One section, no card: the patterned band is its ground.
 */
export function HomeProgress({
  locale,
  route,
  spots,
  stamped,
  total,
  badges,
  readyCount,
  bookmarks,
}: {
  locale: string;
  /** The course to go on with; undefined when every course is done or none is open. */
  route: RouteSummary | undefined;
  /** That course's stamp places, in order. */
  spots: SpotListItem[];
  stamped: number;
  total: number;
  badges: number;
  readyCount: number;
  bookmarks: number;
}) {
  const started = (route?.stampedCount ?? 0) > 0;
  const next = spots.filter((s) => s.stamped === false && !offersNoStamp(s.status) && !s.stopBy).slice(0, 3);
  const [first, ...more] = next;
  const sealed = new Set(spots.flatMap((s, i) => (s.stamped ? [i + 1] : [])));

  return (
    <section aria-labelledby="home-next" className="@container mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 @[34rem]:px-6">
      <div className="flex flex-col gap-6 @3xl:grid @3xl:grid-cols-[1fr_auto] @3xl:items-start @3xl:gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id="home-next" className="text-2xl font-bold leading-snug">
            {route ? (
              started ? <Trans>続きを歩きませんか？</Trans> : <Trans>はじめの道を歩きませんか？</Trans>
            ) : stamped > 0 && stamped >= total ? (
              <Trans>すべてそろいました。</Trans>
            ) : (
              <Trans>まだスタンプはありません。</Trans>
            )}
          </h2>
          {route ? (
            <p className="text-xl font-bold leading-snug">
              <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
            </p>
          ) : null}

          {first ? (
            <div className="flex flex-col">
              <p className="text-lg text-muted">
                <Trans>つぎの場所</Trans>
              </p>
              {/* The one thing to tap: big, with the whole row as the target. */}
              <Link href={`/spots/${first.id}`} className="tap-target flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 font-serif text-3xl font-bold leading-snug text-accent">
                  <Localized value={pickText(locale, first.nameJa, first.nameEn)} tag={false} />
                </span>
                <ChevronIcon />
              </Link>
              {more.length > 0 ? (
                <ul>
                  {more.map((spot) => (
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
              ) : null}
            </div>
          ) : null}
        </div>

        {/* This course's seals, the next one ringed with つぎ. Each seal says its state in words to a screen reader. A phone:
            four to a row. Stacked with room (a tablet): one strip across the width, as many as fit, so the right side is
            not left empty. Beside the words (@3xl): a compact block of four again. */}
        {route && spots.length > 0 ? (
          <StampGrid
            total={spots.length}
            stamped={sealed}
            columns={4}
            className="w-full max-w-xs @[26rem]:max-w-none @[26rem]:grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] @3xl:w-72 @3xl:max-w-xs @3xl:grid-cols-4"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-line/40 pt-4 @[34rem]:flex-row @[34rem]:items-center @[34rem]:justify-between">
        <p className="flex flex-wrap gap-x-6 text-lg">
          <Link href="/rallies" className={link}>
            <Trans>ラリー</Trans> {stamped} / {total}
          </Link>
          <Link href="/badges" className={link}>
            <Trans>バッジ</Trans> {badges} / {readyCount}
          </Link>
          <Link href="/bookmarks" className={link}>
            <Trans>ブックマーク</Trans> {bookmarks}
          </Link>
        </p>
        {route ? (
          <ButtonLink href={`/routes/${route.id}`}>
            <Trans>この道を見る</Trans>
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}

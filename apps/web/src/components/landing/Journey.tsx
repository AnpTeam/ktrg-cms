import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";
import { Chapter } from "@/components/landing/Chapter";
import { JourneyScene } from "@/components/landing/JourneyScene";
import { LandingHero } from "@/components/landing/LandingHero";
import type { BannerSlide } from "@/lib/banners";
import type { RouteSummary } from "@/lib/content";
import type { HomeSlot } from "@/lib/home-text";
import { moundSealPoints, stageLine } from "@/lib/journey";
import { MOUND_PLACES, TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import { RIDGE_HEIGHT, RIDGE_WIDTH, ridgePath } from "@/lib/ridge";

/**
 * The landing for a first-time visitor, as four beats (docs/landing-journey-design.md): the sea (the hero), the ridge (what
 * Katsuragi Shugen is, the real line of the whole trail), the seals (the stamp rally) and the start (the two buttons).
 *
 * This is the complete page as plain stacked sections: the ridge is drawn, the seals are placed, every word and button is
 * there. It is what a visitor gets with no script, with calm on, or with reduced motion. JourneyScene (motion allowed) only
 * adds to it, through the data-* markers: data-journey (the whole), data-beat 0..3, data-ridge (the line), data-seal.
 * The words are the editable home words, so an editor's text shows here too.
 */
export function Journey({ slides, routes, locale, w }: { slides: BannerSlide[]; routes: RouteSummary[]; locale: string; w: Record<HomeSlot, string> }) {
  const ridge = ridgePath(routes);
  const line = stageLine(ridge);
  // One seal for every stamp place, grouped by mound: a mound with two places (3, 14, 28) gets a pair.
  const seals = moundSealPoints(line.points, MOUND_PLACES);

  return (
    <JourneyScene seals={TOTAL_STAMPS}>
      {/* For anyone who does not want the introduction: a real link, first in the tab order. */}
      <a href="#after-journey" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-40 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-lg focus:font-bold focus:text-ink focus:underline">
        <Trans>スキップ</Trans>
      </a>
      <div data-journey-stage>
        <div data-beat="0">
          <LandingHero slides={slides} locale={locale} line={w.heroLine} bare />
        </div>

        <div data-beat="1">
          <Chapter ground="story-ground-inverse" heading={w.storyHeading} id="story-title">
            <p className="text-lg leading-9">{w.storyText}</p>
            {/* One ruled row per fact on a phone (English values are longer), three columns from a wider box. */}
            <dl className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-3 @[34rem]:text-center">
              <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
              <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
              <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
            </dl>
          </Chapter>
        </div>

        {/* The line of the whole trail and a seal for every sutra mound. The real profile when we hold one, else a plain straight
            line (never an invented one); the seals stand evenly along it, for the rally, not as places on a map. */}
        <figure data-ridge-stage className="story-ground-inverse flex flex-col gap-3 px-5 pb-16 @[42rem]:px-10">
          <div className="relative mx-auto h-32 w-full max-w-5xl @[42rem]:h-44" aria-hidden="true">
            <svg viewBox={`0 0 ${RIDGE_WIDTH} ${RIDGE_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <path data-ridge d={line.d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            {/* HTML dots on the line, so they stay round while the picture is stretched to the width. */}
            {seals.map(([x, y], i) => (
              <span
                key={i}
                data-seal
                // The ring is the figure's own text colour (pale on the night stage, ink on paper): the shu fill alone is under 3:1 on night.
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-shu ring-1 ring-current @[42rem]:size-3 @[42rem]:ring-2"
                style={{ left: `${(x / RIDGE_WIDTH) * 100}%`, top: `${(y / RIDGE_HEIGHT) * 100}%` }}
              />
            ))}
          </div>
          {ridge ? (
            <figcaption className="mx-auto w-full max-w-5xl text-base opacity-90">
              <Trans>
                海から山へ。{ridge.courses}区間の道の高さを、順につなげた線です。いちばん高いところは約{ridge.topM}m。
              </Trans>
            </figcaption>
          ) : null}
        </figure>

        <div data-beat="2">
          <Chapter ground="story-ground-surface" heading={w.rallyHeading} id="rally-title">
            <p className="font-serif text-2xl font-bold leading-snug">{w.rallyLead}</p>
            <p className="text-lg leading-9">{w.rallyText}</p>
            <Link href="/rallies" className={buttonStyle("secondary", "lg", "flex w-full @[34rem]:w-fit")}>
              <Trans>ラリーを見る</Trans>
            </Link>
          </Chapter>
        </div>

        <div data-beat="3">
          <Chapter ground="story-ground-paper" heading={w.startHeading} id="start-title">
            <div className="flex flex-col gap-3 @[34rem]:flex-row @[34rem]:items-center">
              <Link href="/register" className={buttonStyle("primary", "lg", "flex")}>
                <Trans>新規登録</Trans>
              </Link>
              <Link href="/routes" className={buttonStyle("secondary", "lg", "flex")}>
                <Trans>ルートをさがす</Trans>
              </Link>
            </div>
            <p className="text-lg">
              <Trans>登録済みの方は</Trans>{" "}
              <Link href="/login" className="tap-target inline-flex items-center font-bold underline underline-offset-4">
                <Trans>ログイン</Trans>
              </Link>
            </p>
          </Chapter>
        </div>
      </div>
    </JourneyScene>
  );
}

function Fact({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-current pt-3 @[34rem]:flex-col @[34rem]:items-stretch @[34rem]:justify-start @[34rem]:gap-1">
      <dt className="text-base opacity-90">{term}</dt>
      <dd className="text-lg font-bold @[34rem]:text-xl">{value}</dd>
    </div>
  );
}

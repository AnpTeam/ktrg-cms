import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { StampGrid } from "@/components/StampGrid";
import { buttonStyle } from "@/components/button";
import { StoryMotion } from "@/components/landing/StoryMotion";
import type { RouteSummary } from "@/lib/content";
import type { HomeSlot } from "@/lib/home-text";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import { RIDGE_HEIGHT, RIDGE_WIDTH, ridgePath } from "@/lib/ridge";

/**
 * The landing for a first-time visitor, told as three chapters (docs/design-language.md, the reading register): what
 * Katsuragi Shugen is, with the real ridge of the whole trail; the stamp rally; and where to start. Each chapter has its
 * own ground and a vertical headline when the screen is tall enough. The words are the editable home words, so an
 * editor's text shows here too. StoryMotion only adds motion on top; without it the page is the same, still.
 */
export function LandingStory({ routes, w }: { routes: RouteSummary[]; w: Record<HomeSlot, string> }) {
  const ridge = ridgePath(routes);
  return (
    <StoryMotion>
      <Chapter ground="story-ground-inverse" heading={w.storyHeading} id="story-title">
        <p className="text-lg leading-9">{w.storyText}</p>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
          <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
          <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
        </dl>
        {ridge ? (
          <figure className="flex flex-col gap-2">
            {/* The real profile, so it is a picture with words, not decoration. */}
            <svg viewBox={`0 0 ${RIDGE_WIDTH} ${RIDGE_HEIGHT}`} preserveAspectRatio="none" role="img" aria-labelledby="ridge-caption" className="h-28 w-full overflow-visible @[42rem]:h-40">
              <path data-ridge d={ridge.d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            <figcaption id="ridge-caption" className="text-base opacity-90">
              <Trans>
                海から山へ。{ridge.courses}区間の道の高さを、順につなげた線です。いちばん高いところは約{ridge.topM}m。
              </Trans>
            </figcaption>
          </figure>
        ) : null}
      </Chapter>

      <Chapter ground="story-ground-surface" heading={w.rallyHeading} id="rally-title">
        <p className="font-serif text-2xl font-bold leading-snug">{w.rallyLead}</p>
        <p className="text-lg leading-9">{w.rallyText}</p>
        {/* A sample of the seals: the page's own picture, so a screen reader skips it. */}
        <div aria-hidden="true" className="max-w-sm">
          <StampGrid total={8} stamped={new Set([1, 2, 3])} showNext={false} columns={4} />
        </div>
        <Link href="/rallies" className={buttonStyle("secondary", "lg", "flex w-full @[34rem]:w-fit")}>
          <Trans>ラリーを見る</Trans>
        </Link>
      </Chapter>

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
    </StoryMotion>
  );
}

/**
 * One chapter: its ground, a headline set vertically on the right when the screen is tall enough (else across the
 * top), and the words beside it, which fade up together when motion is on (`data-reveal`).
 */
function Chapter({ ground, heading, id, children }: { ground: string; heading: string; id: string; children: ReactNode }) {
  return (
    <section data-ground aria-labelledby={id} className={`${ground} @container py-20 @[42rem]:py-28`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 tall:flex-row-reverse tall:items-start tall:gap-6 @[42rem]:px-10 tall:@[42rem]:gap-16">
        <h2 id={id} className="font-serif text-3xl font-bold leading-snug tracking-widest text-inherit tall:max-h-[22rem] tall:[writing-mode:vertical-rl] @[42rem]:text-4xl">
          {heading}
        </h2>
        <div data-reveal className="flex min-w-0 max-w-[40em] flex-1 flex-col gap-6">
          {children}
        </div>
      </div>
    </section>
  );
}

function Fact({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-current pt-3">
      <dt className="text-base opacity-90">{term}</dt>
      <dd className="whitespace-nowrap text-lg font-bold @[34rem]:text-xl">{value}</dd>
    </div>
  );
}

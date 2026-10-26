import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { IntroVideo } from "@/components/IntroVideo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PlaceLine } from "@/components/PlaceLine";
import { SectionBanner } from "@/components/SectionBanner";
import { RouteStats } from "@/components/RouteStats";
import { TrailNode } from "@/components/TrailNode";
import { BannerCarousel } from "@/components/landing/BannerCarousel";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMap } from "@/components/landing/LandingMap";
import { TrailNotices } from "@/components/landing/TrailNotices";
import type { BannerSlide } from "@/lib/banners";
import { municipalityName } from "@/lib/municipalities";
import { pickText, type RouteSummary } from "@/lib/content";
import type { TrailNotice } from "@/lib/notices";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import { nodeState, progressShare } from "@/lib/ribbon";
import type { EmbedVideo } from "@/lib/video";

const primary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper";
const secondary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl border border-ink bg-surface px-6 text-xl font-bold text-ink hover:bg-paper";
// Panels have no outline: a light grey fill with round corners, and room around them.
const panel = "mx-4 rounded-3xl bg-surface p-5";
const PREVIEW_ROUTES = 5;

/**
 * The home page. From the top: the drawn hero (or, for a signed-in visitor, `top`: the greeting and where to go on),
 * banners, dated trail notices (only when there are any), the courses that are ready, what Katsuragi Shugen is, a small
 * map of every course, an intro video (only when one is set), what to know before leaving, and a footer with the source.
 * The stamp rally is not a section of its own here (a banner can carry it).
 *
 * No photos (none are cleared for use yet) and no invented facts: the numbers come from `lib/rally`, the
 * course names from the course list, the Katsuragi text from the official Japan Heritage site.
 */
export function Landing({
  locale,
  routes,
  notices,
  introVideo,
  slides,
  blogUrl,
  top,
}: {
  locale: string;
  routes: RouteSummary[];
  notices: TrailNotice[];
  introVideo: EmbedVideo | null;
  slides: BannerSlide[];
  blogUrl: string | null;
  /** For a signed-in visitor: shown in place of the hero (and the sign-up buttons are left out). */
  top?: ReactNode;
}) {
  // Routes that are ready first, then the coming-soon ones; each keeps its own number.
  const firstRoutes = [...routes].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon") || a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns from 1024 px. The drawn hero comes first and the wide sections
    // (notices, video, the start buttons, the footer) span both.
    <div className="grid grid-cols-1 gap-10 pt-4 lg:grid-cols-2 lg:gap-x-8 lg:pt-0">
      {top ? (
        <div className="lg:col-span-2">{top}</div>
      ) : (
        <div className="px-4 lg:col-span-2 lg:px-0">
          <LandingHero />
        </div>
      )}

      {slides.length > 0 ? (
        <div className="lg:col-span-2">
          <BannerCarousel slides={slides} />
        </div>
      ) : null}

      <div className="lg:col-span-2">
        <TrailNotices notices={notices} locale={locale} blogUrl={blogUrl} />
      </div>

      {firstRoutes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="px-4">
            <SectionBanner>
              <Trans>歩く道</Trans>
            </SectionBanner>
          </div>
          <div className={panel}>
            <ol>
              {firstRoutes.map((route, i) => (
                <PreviewStop
                  key={route.id}
                  route={route}
                  locale={locale}
                  last={i === firstRoutes.length - 1}
                  href={`/routes/${route.id}`}
                />
              ))}
            </ol>
            <Link href="/routes" className={`${secondary} mt-4`}>
              <Trans>全{TOTAL_ROUTES}区間を見る</Trans>
            </Link>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>葛城修験とは</Trans>
          </SectionBanner>
        </div>
        <div className={panel}>
          {/* Our own wording of well-known facts (the official site's text is protected; see CLAUDE.md, 2026-10-17). */}
          <p className="max-w-prose text-lg leading-8">
            <Trans>
              和泉山脈から金剛山地へ。大阪・和歌山・奈良の境にのびるこの山なみは、古くから「葛城」と呼ばれ、神の宿る山として敬われてきました。山で心身をきたえる修験道を開いたと伝わる役行者が、はじめて修行をしたのも、この山々だといわれています。
            </Trans>
          </p>
          <dl className="mt-4">
            <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
            <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
            <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
          </dl>
        </div>
      </section>

      <LandingMap routes={routes} />

      {introVideo ? (
        <section className="flex flex-col gap-3 lg:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <Trans>動画で見る</Trans>
            </SectionBanner>
          </div>
          <div className="px-4">
            <IntroVideo video={introVideo} title={locale === "ja" ? "葛城修験の紹介動画" : "Katsuragi Shugen introduction video"} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <Trans>出かける前に</Trans>
          </SectionBanner>
        </div>
        <ul className={`${panel} flex flex-col gap-3 text-lg leading-8`}>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>山道です。天気と、水や食べ物、歩きやすい靴を用意してください。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>山の中は、電波がつながりにくいことがあります。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent">
              ・
            </span>
            <Trans>道が通れないときは、無理をせず引き返してください。</Trans>
          </li>
        </ul>
        <Notice>
          <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
        </Notice>
      </section>

      {top ? null : (
      <section className="flex flex-col gap-3 px-4 lg:col-span-2 lg:hidden">
        <SectionBanner>
          <Trans>さあ、はじめましょう</Trans>
        </SectionBanner>
        <div className="flex flex-col gap-3">
          <Link href="/register" className={primary}>
            <Trans>新規登録</Trans>
          </Link>
          <Link href="/routes" className={secondary}>
            <Trans>ルートをさがす</Trans>
          </Link>
        </div>
      </section>
      )}

      <footer className="flex flex-col gap-4 border-t-2 border-line px-4 pb-6 pt-6 lg:col-span-2">
        <LocaleSwitcher />
      </footer>
    </div>
  );
}

/** One of the first courses on the page's own little trail: a node, a line down to the next, its name. */
function PreviewStop({ route, locale, last, href }: { route: RouteSummary; locale: string; last: boolean; href: string }) {
  const soon = route.status === "soon";
  const { stampedCount, spotCount } = route;
  const state = nodeState({ status: route.status, stamped: stampedCount, total: spotCount });
  const body = (
    <span className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className={`block text-xl font-bold leading-snug ${soon ? "text-muted" : "text-accent"}`}>
          <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
        </span>
        {route.prefecture || route.municipality ? (
          <span className="mt-1 block text-lg text-muted">
            <PlaceLine prefecture={route.prefecture} place={municipalityName(locale, route.municipality)} locale={locale} />
          </span>
        ) : null}
        {soon ? (
          <span className="mt-1 inline-block rounded-lg border-2 border-dashed border-line px-2 text-base font-bold text-muted">
            <Trans>準備中</Trans>
          </span>
        ) : (
          <span className="mt-2 block">
            {/* Distance and time only: the full set wraps onto three rows in this narrow column. */}
            <RouteStats route={{ ...route, elevationGainM: null, difficulty: null, physicalLevel: null, technicalLevel: null }} compact />
          </span>
        )}
        {stampedCount !== null && spotCount > 0 ? (
          <span className="mt-1 block text-lg font-bold tabular-nums">
            <Trans>
              スタンプ {stampedCount} / {spotCount}
            </Trans>
          </span>
        ) : null}
      </span>
    </span>
  );
  return (
    <li className="relative pb-6 pl-16 last:pb-0">
      <span className="absolute left-0 top-0">
        <TrailNode state={state} order={route.order} share={progressShare(stampedCount, spotCount)} />
      </span>
      {last ? null : <span aria-hidden="true" className="absolute bottom-0 left-[21px] top-11 w-0.5 bg-brand" />}
      {soon ? (
        <div className="py-1">{body}</div>
      ) : (
        <Link href={href} className="tap-target block">
          {body}
        </Link>
      )}
    </li>
  );
}

function Fact({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line/30 py-3">
      <dt className="text-lg text-muted">{term}</dt>
      <dd className="text-2xl font-bold tabular-nums text-accent">{value}</dd>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { IntroVideo } from "@/components/IntroVideo";
import { KatsuragiLogo } from "@/components/KatsuragiLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteSilhouette } from "@/components/RouteSketch";
import { SectionBanner } from "@/components/SectionBanner";
import { StampGrid } from "@/components/StampGrid";
import { TrailNode } from "@/components/TrailNode";
import { BannerCarousel } from "@/components/landing/BannerCarousel";
import { LandingHero } from "@/components/landing/LandingHero";
import { TrailNotices } from "@/components/landing/TrailNotices";
import type { BannerSlide } from "@/lib/banners";
import { municipalityName } from "@/lib/municipalities";
import { pickText, type RouteSummary } from "@/lib/content";
import type { TrailNotice } from "@/lib/notices";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import type { EmbedVideo } from "@/lib/video";

const primary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand";
const secondary =
  "tap-target flex min-h-14 items-center justify-center rounded-xl border-2 border-brand bg-surface px-6 text-xl font-bold text-accent hover:bg-paper";
// Panels have no outline: a light grey fill with round corners, and room around them.
const panel = "mx-4 rounded-3xl bg-surface p-5";
const patternPanel = `${panel} pattern-shippo`;

// The few stamp slots drawn in the example card; they are an illustration, never anyone's progress.
const EXAMPLE_SLOTS = 8;
const EXAMPLE_STAMPED: ReadonlySet<number> = new Set([1, 2, 3]);
const PREVIEW_ROUTES = 3;

/**
 * The first screen for someone who is not signed in. From the top: what this is and the way west to east,
 * dated trail notices (only when there are any), the stamp card, the first courses, an intro video (only when
 * one is set), what Katsuragi Shugen is (the official text), and a footer with the source.
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
}: {
  locale: string;
  routes: RouteSummary[];
  notices: TrailNotice[];
  introVideo: EmbedVideo | null;
  slides: BannerSlide[];
  blogUrl: string | null;
}) {
  const firstRoutes = [...routes].sort((a, b) => a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns from 1024 px, where the big drawn hero comes first and the wide
    // sections (notices, video, the start buttons, the footer) span both.
    <div className="grid grid-cols-1 gap-10 pt-4 lg:grid-cols-2 lg:gap-x-8 lg:pt-0">
      <div className="hidden lg:col-span-2 lg:block">
        <LandingHero />
      </div>

      {slides.length > 0 ? (
        <div className="lg:col-span-2">
          <BannerCarousel slides={slides} />
        </div>
      ) : null}

      <section className="px-4 lg:hidden">
        <div className="frame pattern-shippo p-5">
          {/* The logo is the picture of the name; the heading keeps the real text for screen readers and search. */}
          <h1>
            <span className="sr-only">
              <Trans>葛城修験</Trans>
            </span>
            <KatsuragiLogo className="h-auto w-full max-w-md" />
          </h1>
          <p className="mt-2 font-serif text-2xl font-bold leading-snug">
            <Trans>「祈り」を見つめる再発見の旅</Trans>
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/register" className={primary}>
              <Trans>新規登録</Trans>
            </Link>
            <Link href="/routes" className={secondary}>
              <Trans>ルートをさがす</Trans>
            </Link>
            <p className="text-lg opacity-80">
              <Trans>登録済みの方は</Trans>{" "}
              <Link href="/login" className="font-bold">
                <Trans>ログイン</Trans>
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="lg:col-span-2">
        <TrailNotices notices={notices} locale={locale} blogUrl={blogUrl} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="px-4">
          <SectionBanner>
            <Trans>スタンプカード</Trans>
          </SectionBanner>
        </div>
        <div className={patternPanel}>
          <p className="text-xl font-bold leading-snug">
            <Trans>着いたらボタンを押すだけ。場所を確かめて、スタンプがたまります。</Trans>
          </p>
          {/* An illustration: hidden from screen readers so it is not read out as someone's progress. */}
          <div aria-hidden="true" className="mt-4">
            <StampGrid total={EXAMPLE_SLOTS} stamped={EXAMPLE_STAMPED} showNext={false} columns={4} art />
          </div>
          <p className="mt-3 text-lg text-muted">
            <Trans>これは見本です。経塚のスタンプは全{TOTAL_STAMPS}か所。</Trans>
          </p>
        </div>
      </section>

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

      <section className="flex flex-col gap-3">
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

      <footer className="flex flex-col gap-4 border-t-2 border-line px-4 pb-6 pt-6 lg:col-span-2">
        <p className="text-lg leading-7">
          <Trans>歴史や観光の情報は、日本遺産「葛城修験」の公式サイトでも見られます。</Trans>
        </p>
        <a
          href="https://katsuragisyugen-nihonisan.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target inline-flex items-center text-lg font-bold underline"
        >
          <Trans>公式サイトをひらく</Trans>
        </a>
        <LocaleSwitcher />
      </footer>
    </div>
  );
}

/** One of the first courses on the page's own little trail: a node, a line down to the next, its name. */
function PreviewStop({ route, locale, last, href }: { route: RouteSummary; locale: string; last: boolean; href: string }) {
  const soon = route.status === "soon";
  const body = (
    <span className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className={`block text-xl font-bold leading-snug ${soon ? "text-muted" : "text-accent"}`}>
          <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
        </span>
        {route.prefecture || route.municipality ? (
          <span className="mt-1 block text-lg text-muted">
            {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
            {route.prefecture && route.municipality ? " " : null}
            {municipalityName(locale, route.municipality)}
          </span>
        ) : null}
        {soon ? (
          <span className="mt-1 inline-block rounded-lg border-2 border-dashed border-line px-2 text-base font-bold text-muted">
            <Trans>準備中</Trans>
          </span>
        ) : null}
      </span>
      {route.sketch ? <RouteSilhouette sketch={route.sketch} /> : null}
    </span>
  );
  return (
    <li className="relative pb-6 pl-16 last:pb-0">
      <span className="absolute left-0 top-0">
        <TrailNode state={soon ? "soon" : "neutral"} order={route.order} share={0} />
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

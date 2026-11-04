import Image from "next/image";
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
import { BlogCard } from "@/components/landing/BlogCard";
import { TrailNotices } from "@/components/landing/TrailNotices";
import type { BannerSlide } from "@/lib/banners";
import { municipalityName } from "@/lib/municipalities";
import { pickText, type RouteSummary } from "@/lib/content";
import type { TrailNotice } from "@/lib/notices";
import type { BlogPost } from "@/lib/posts";
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
// The Japan Heritage council's site: its text and photos are reused here with their permission (decisions log 2026-11-02).
const OFFICIAL = "https://katsuragisyugen-nihonisan.com";

/**
 * The home page. From the top: the drawn hero (or, for a signed-in visitor, `top`: the greeting and where to go on),
 * banners, dated trail notices (only when there are any), the courses that are ready, what Katsuragi Shugen is, a small
 * map of every course, an intro video (only when one is set), what to know before leaving, and a footer with the source.
 * The stamp rally is not a section of its own here (a banner can carry it).
 *
 * The photos and the story text are the Japan Heritage council's, reused with their permission (decisions log
 * 2026-11-02). No invented facts: the numbers come from `lib/rally`, the course names from the course list.
 */
export function Landing({
  locale,
  routes,
  notices,
  introVideo,
  slides,
  posts,
  top,
}: {
  locale: string;
  routes: RouteSummary[];
  notices: TrailNotice[];
  introVideo: EmbedVideo | null;
  slides: BannerSlide[];
  posts: BlogPost[];
  /** For a signed-in visitor: shown in place of the hero (and the sign-up buttons are left out). */
  top?: ReactNode;
}) {
  // Routes that are ready first, then the coming-soon ones; each keeps its own number.
  const firstRoutes = [...routes].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon") || a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns from 1024 px. The drawn hero comes first and the wide sections
    // (notices, video, the start buttons, the footer) span both.
    <div className="grid grid-cols-1 gap-10 pt-4 lg:grid-cols-2 lg:gap-x-8 lg:pt-0">
      {/* With a dashboard (someone who has stamps or an account) the banners, the current events, come first. */}
      {top && slides.length > 0 ? (
        <div className="lg:col-span-2">
          <BannerCarousel slides={slides} />
        </div>
      ) : null}

      {top ? (
        <div className="lg:col-span-2">{top}</div>
      ) : (
        <div className="px-4 lg:col-span-2 lg:px-0">
          <LandingHero />
        </div>
      )}

      {!top && slides.length > 0 ? (
        <div className="lg:col-span-2">
          <BannerCarousel slides={slides} />
        </div>
      ) : null}

      {/* Where to eat, buy and stay: the council's own pages, so the lists stay current without us (reused with their permission). */}
      <section aria-labelledby="tourism-title" className="flex flex-col gap-3 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="tourism-title">
              <Trans>観光情報</Trans>
            </span>
          </SectionBanner>
        </div>
        <ul className="grid grid-cols-2 gap-3 px-4 md:grid-cols-5">
          {[
            { cat: "cat01", img: "/home/tourism_1.jpg", label: <Trans>観光</Trans> },
            { cat: "cat02", img: "/home/tourism_2.jpg", label: <Trans>グルメ</Trans> },
            { cat: "cat03", img: "/home/tourism_3.jpg", label: <Trans>お土産</Trans> },
            { cat: "cat04", img: "/home/tourism_4.jpg", label: <Trans>体験</Trans> },
            { cat: "cat05", img: "/home/tourism_5.jpg", label: <Trans>宿泊</Trans> },
          ].map((c, i) => (
            <li key={c.cat} className={i === 4 ? "col-span-2 md:col-span-1 [&>a]:aspect-[2.4/1] md:[&>a]:aspect-square" : ""}>
              <a href={`${OFFICIAL}/tourism/${c.cat}/`} target="_blank" rel="noopener noreferrer" className="tap-target relative block aspect-[594/366] overflow-hidden rounded-lg md:aspect-square">
                <Image src={c.img} alt="" fill sizes="(min-width: 768px) 20vw, 50vw" className="object-cover" />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 px-3 pb-2 font-serif text-2xl font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">{c.label}</span>
                <span className="sr-only">
                  <Trans>（公式サイト、新しいタブで開きます）</Trans>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="lg:col-span-2">
        <TrailNotices notices={notices} locale={locale} />
      </div>

      <div className="lg:col-span-2">
        <BlogCard posts={posts} locale={locale} />
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

      <section aria-labelledby="story-title" className="flex flex-col gap-4 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="story-title">
              <Trans>日本遺産 葛城修験ストーリー</Trans>
            </span>
          </SectionBanner>
        </div>
        <div className={`${panel} grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-8`}>
          <div>
            {/* The council's own words, reused with their permission (decisions log 2026-11-02). */}
            <p className="max-w-prose text-lg leading-8">
              <Trans>大阪と和歌山の府県境を東西に走る和泉山脈。</Trans>
              <br />
              <Trans>
                大阪と奈良の府県境に南北に聳える金剛山地－この峰々一帯は「葛城」と呼ばれ、多くの神々が住まう山として人々に崇められておりました。
              </Trans>
              <br />
              <Trans>そして修験道の開祖である役行者が最初の修行を積んだのがこの地です。</Trans>
            </p>
            <dl className="mt-4">
              <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
              <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
              <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
            </dl>
            <a href={`${OFFICIAL}/story/`} target="_blank" rel="noopener noreferrer" className={`${secondary} mt-4`}>
              <Trans>詳しくは公式サイトへ</Trans>
            </a>
          </div>
          <figure className="flex flex-col items-center gap-2">
            <Image src="/home/story_img.png" alt="" width={834} height={547} sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full rounded-lg" />
            <figcaption className="text-base text-muted">
              <Trans>役小角（役行者）</Trans>
            </figcaption>
          </figure>
        </div>
        <ul className="grid gap-4 px-4 md:grid-cols-2">
          {[
            { path: "/about/", src: "/home/about_katsuragi.jpg", label: <Trans>葛城修験の基礎知識</Trans> },
            { path: "/cultural_property/", src: "/home/cultural_property.jpg", label: <Trans>構成文化財</Trans> },
          ].map((card) => (
            <li key={card.path}>
              <a href={`${OFFICIAL}${card.path}`} target="_blank" rel="noopener noreferrer" className="tap-target relative block overflow-hidden rounded-lg">
                <Image src={card.src} alt="" width={800} height={195} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 px-3 text-center font-serif text-2xl font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">{card.label}</span>
                <span className="sr-only">
                  <Trans>（公式サイト、新しいタブで開きます）</Trans>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {introVideo ? (
        <section className="flex flex-col gap-3 lg:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <Trans>動画で見る</Trans>
            </SectionBanner>
          </div>
          <div className="px-4">
            <IntroVideo video={introVideo} title={locale === "ja" ? "葛城修験の紹介動画" : "Katsuragi Shugen introduction video"} />
            <p className="mt-2 text-base text-muted">
              <Trans>日本遺産「葛城修験」PR動画（180秒）</Trans>
            </p>
          </div>
        </section>
      ) : null}

      <LandingMap routes={routes} />

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
        <p className="text-base text-muted">
          <Trans>写真と文章の一部は、</Trans>
          <a href={OFFICIAL} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            <Trans>葛城修験日本遺産活用推進協議会の公式サイト</Trans>
          </a>
          <Trans>のものです。</Trans>
        </p>
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

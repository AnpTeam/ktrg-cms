import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { IntroVideo } from "@/components/IntroVideo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Notice } from "@/components/Notice";
import { SectionBanner } from "@/components/SectionBanner";
import { StampGrid } from "@/components/StampGrid";
import { TrailRibbon } from "@/components/TrailRibbon";
import { BannerCarousel } from "@/components/landing/BannerCarousel";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMap } from "@/components/landing/LandingMap";
import { BlogCard } from "@/components/landing/BlogCard";
import { TrailNotices } from "@/components/landing/TrailNotices";
import type { BannerSlide } from "@/lib/banners";
import type { RouteSummary } from "@/lib/content";
import type { TrailNotice } from "@/lib/notices";
import type { BlogPost } from "@/lib/posts";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import type { EmbedVideo } from "@/lib/video";
import { buttonStyle } from "@/components/button";

const primary =
  buttonStyle("primary", "lg", "flex");
const secondary =
  buttonStyle("secondary", "lg", "flex");
// Panels have no outline: a light grey fill with round corners, and room around them.
const panel = "mx-4 rounded-3xl bg-surface p-5";
const PREVIEW_ROUTES = 6;
// The Japan Heritage council's site: its photos and a few links are used here with their permission (decisions log 2026-11-02).
const OFFICIAL = "https://katsuragisyugen-nihonisan.com";

/**
 * The home page, walk first. From the top: the banner photos with the logo and the line (or, for a signed-in visitor,
 * `top`: the greeting and where to go on), what the stamp rally is, the courses as photo cards, the map of every course,
 * the trail notices and the blog, a short word on what Katsuragi Shugen is, the intro video, a few links to the council's
 * own pages, the tourism cards (only when an admin turned them on), and what to know before leaving.
 *
 * No invented facts: the numbers come from `lib/rally` and the course names from the course list. The story's words
 * are ours; the council's photos are used with their permission and credited at the end.
 */
export function Landing({
  locale,
  routes,
  notices,
  introVideo,
  slides,
  posts,
  showTourism,
  top,
}: {
  locale: string;
  routes: RouteSummary[];
  notices: TrailNotice[];
  introVideo: EmbedVideo | null;
  slides: BannerSlide[];
  posts: BlogPost[];
  /** The tourism cards are shown only when an admin switched them on (管理 > サイト全体の設定). */
  showTourism: boolean;
  /** For a signed-in visitor: shown in place of the hero (and the sign-up buttons are left out). */
  top?: ReactNode;
}) {
  // Routes that are ready first, then the coming-soon ones; each keeps its own number.
  const firstRoutes = [...routes].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon") || a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns from 1024 px. Most sections span both.
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
          <LandingHero slides={slides} locale={locale} />
        </div>
      )}

      {top ? null : (
        <section aria-labelledby="rally-title" className="flex flex-col gap-3 lg:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <span id="rally-title">
                <Trans>スタンプラリー</Trans>
              </span>
            </SectionBanner>
          </div>
          <div className={`${panel} grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-10`}>
            <div className="flex flex-col gap-3">
              <p className="font-serif text-2xl font-bold leading-snug">
                <Trans>歩いて、スタンプを集めよう。</Trans>
              </p>
              <p className="max-w-prose text-lg leading-8">
                <Trans>行き先の近くでボタンを押すと、スタンプがたまります。位置は、押した一回だけ調べ、保存しません。</Trans>
              </p>
              <Link href="/rallies" className={`${secondary} mt-1 lg:w-fit`}>
                <Trans>ラリーを見る</Trans>
              </Link>
            </div>
            {/* A sample of the seals: the page's own picture, so a screen reader skips it. */}
            <div aria-hidden="true">
              <StampGrid total={8} stamped={new Set([1, 2, 3])} showNext={false} columns={4} />
            </div>
          </div>
        </section>
      )}

      {firstRoutes.length > 0 ? (
        <section className="flex flex-col gap-3 lg:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <Trans>歩く道</Trans>
            </SectionBanner>
          </div>
          <TrailRibbon routes={firstRoutes} hrefFor={(route) => `/routes/${route.id}`} locale={locale} />
          <div className="px-4">
            <Link href="/routes" className={secondary}>
              <Trans>全{TOTAL_ROUTES}区間を見る</Trans>
            </Link>
          </div>
        </section>
      ) : null}

      <LandingMap routes={routes} />

      <div className="lg:col-span-2">
        <TrailNotices notices={notices} locale={locale} />
      </div>

      <div className="lg:col-span-2">
        <BlogCard posts={posts} locale={locale} />
      </div>

      <section aria-labelledby="story-title" className="flex flex-col gap-3 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="story-title">
              <Trans>葛城修験とは</Trans>
            </span>
          </SectionBanner>
        </div>
        <div className={`${panel} grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-8`}>
          <div>
            {/* Our own wording of well-known facts. */}
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
          <figure className="flex flex-col items-center gap-2">
            <Image src="/home/story_img.png" alt="" width={834} height={547} sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full max-w-md rounded-lg" />
            <figcaption className="text-base text-muted">
              <Trans>役小角（役行者）</Trans>
            </figcaption>
          </figure>
        </div>
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

      <section aria-labelledby="official-title" className="flex flex-col gap-3 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="official-title">
              <Trans>公式サイトで、もっと知る</Trans>
            </span>
          </SectionBanner>
        </div>
        <ul className="grid gap-3 px-4 md:grid-cols-3">
          {[
            { path: "/story/", label: <Trans>日本遺産 葛城修験ストーリー</Trans> },
            { path: "/about/", label: <Trans>葛城修験の基礎知識</Trans> },
            { path: "/cultural_property/", label: <Trans>構成文化財</Trans> },
          ].map((link) => (
            <li key={link.path}>
              <a href={`${OFFICIAL}${link.path}`} target="_blank" rel="noopener noreferrer" className={`${secondary} text-center`}>
                {link.label}
                <span className="sr-only">
                  <Trans>（公式サイト、新しいタブで開きます）</Trans>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {showTourism ? (
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
      ) : null}

      <section className="flex flex-col gap-3 lg:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <Trans>出かける前に</Trans>
          </SectionBanner>
        </div>
        <ul className={`${panel} flex flex-col gap-3 text-lg leading-8`}>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
            <Trans>山道です。天気と、水や食べ物、歩きやすい靴を用意してください。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
            <Trans>山の中は、電波がつながりにくいことがあります。</Trans>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
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

function Fact({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line/30 py-3">
      <dt className="text-lg text-muted">{term}</dt>
      <dd className="text-2xl font-bold tabular-nums text-accent">{value}</dd>
    </div>
  );
}

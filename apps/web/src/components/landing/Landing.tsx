import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { IntroVideo } from "@/components/IntroVideo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Notice } from "@/components/Notice";
import { SectionBanner } from "@/components/SectionBanner";
import { StampGrid } from "@/components/StampGrid";
import { Localized } from "@/components/Localized";
import { PlaceLine } from "@/components/PlaceLine";
import { RoutePill } from "@/components/RoutePill";
import { BannerCarousel } from "@/components/landing/BannerCarousel";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMap } from "@/components/landing/LandingMap";
import { BlogCard } from "@/components/landing/BlogCard";
import { TrailNotices } from "@/components/landing/TrailNotices";
import { useHomeWords } from "@/components/landing/useHomeWords";
import type { BannerSlide } from "@/lib/banners";
import type { RouteSummary } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import { municipalityName } from "@/lib/municipalities";
import type { HomeText } from "@/lib/home-text";
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
 * `top`: the greeting and where to go on), what the stamp rally is, the courses as wide rows with their photos, the map of every course,
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
  text,
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
  /** What an editor wrote in place of the app's words. */
  text?: HomeText;
}) {
  const w = useHomeWords(text);
  // Routes that are ready first, then the coming-soon ones; each keeps its own number.
  const firstRoutes = [...routes].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon") || a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns on a desktop. Most sections span both. Sized by the page's own width, not
    // the screen's, so the admin's phone-shaped preview shows the phone layout on a desktop.
    <div className="@container">
    <div className="grid grid-cols-1 gap-10 pt-4 @[42rem]:grid-cols-2 @[42rem]:gap-x-8 @[42rem]:pt-0">
      {/* With a dashboard (someone who has stamps or an account) the banners, the current events, come first. */}
      {top && slides.length > 0 ? (
        <div className="@[42rem]:col-span-2 @[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
          <BannerCarousel slides={slides} />
        </div>
      ) : null}

      {top ? (
        <div className="@[42rem]:col-span-2">{top}</div>
      ) : (
        <div className="@[42rem]:col-span-2 @[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
          <LandingHero slides={slides} locale={locale} line={w.heroLine} />
        </div>
      )}

      {top ? null : (
        <section aria-labelledby="rally-title" className="flex flex-col gap-3 @[42rem]:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <span id="rally-title">
                {w.rallyHeading}
              </span>
            </SectionBanner>
          </div>
          <div className={`${panel} grid gap-5 @[42rem]:grid-cols-2 @[42rem]:items-center @[42rem]:gap-10`}>
            <div className="flex flex-col gap-3">
              <p className="font-serif text-2xl font-bold leading-snug">
                {w.rallyLead}
              </p>
              <p className="max-w-prose text-lg leading-8">
                {w.rallyText}
              </p>
              <Link href="/rallies" className={`${secondary} mt-1 @[42rem]:w-fit`}>
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
        <section className="flex flex-col gap-3 @[42rem]:col-span-2">
          <div className="px-4">
            <SectionBanner>
              {w.routesHeading}
            </SectionBanner>
          </div>
          <ul className="flex flex-col gap-3 px-4">
            {firstRoutes.map((route) => {
              const pill = (
                <RoutePill
                  route={route}
                  name={<Localized value={pickText(locale, route.nameJa, route.nameEn)} />}
                  place={route.prefecture || route.municipality ? <PlaceLine prefecture={route.prefecture} place={municipalityName(locale, route.municipality)} locale={locale} /> : null}
                  photo={route.photoUrl}
                />
              );
              return (
                <li key={route.id}>
                  {route.status === "soon" ? (
                    pill
                  ) : (
                    <Link href={`/routes/${route.id}`} className="block rounded-[1.75rem] hover:opacity-95 focus-visible:outline-offset-4">
                      {pill}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="px-4">
            <Link href="/routes" className={secondary}>
              <Trans>全{TOTAL_ROUTES}区間を見る</Trans>
            </Link>
          </div>
        </section>
      ) : null}

      <LandingMap routes={routes} heading={w.mapHeading} />

      <div className="@[42rem]:col-span-2">
        <TrailNotices notices={notices} locale={locale} />
      </div>

      <div className="@[42rem]:col-span-2">
        <BlogCard posts={posts} locale={locale} />
      </div>

      <section aria-labelledby="story-title" className="flex flex-col gap-3 @[42rem]:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="story-title">
              {w.storyHeading}
            </span>
          </SectionBanner>
        </div>
        <div className={`${panel} grid gap-5 @[42rem]:grid-cols-2 @[42rem]:items-center @[42rem]:gap-8`}>
          <div>
            {/* Our own wording of well-known facts. */}
            <p className="max-w-prose text-lg leading-8">
              {w.storyText}
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
              {w.storyCaption}
            </figcaption>
          </figure>
        </div>
      </section>

      {introVideo ? (
        <section className="flex flex-col gap-3 @[42rem]:col-span-2">
          <div className="px-4">
            <SectionBanner>
              {w.videoHeading}
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

      <section aria-labelledby="official-title" className="flex flex-col gap-3 @[42rem]:col-span-2">
        <div className="px-4">
          <SectionBanner>
            <span id="official-title">
              {w.officialHeading}
            </span>
          </SectionBanner>
        </div>
        <ul className="grid gap-3 px-4 @[34rem]:grid-cols-3">
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
        <section aria-labelledby="tourism-title" className="flex flex-col gap-3 @[42rem]:col-span-2">
          <div className="px-4">
            <SectionBanner>
              <span id="tourism-title">
                {w.tourismHeading}
              </span>
            </SectionBanner>
          </div>
          <ul className="grid grid-cols-2 gap-3 px-4 @[34rem]:grid-cols-5">
            {[
              { cat: "cat01", img: "/home/tourism_1.jpg", label: <Trans>観光</Trans> },
              { cat: "cat02", img: "/home/tourism_2.jpg", label: <Trans>グルメ</Trans> },
              { cat: "cat03", img: "/home/tourism_3.jpg", label: <Trans>お土産</Trans> },
              { cat: "cat04", img: "/home/tourism_4.jpg", label: <Trans>体験</Trans> },
              { cat: "cat05", img: "/home/tourism_5.jpg", label: <Trans>宿泊</Trans> },
            ].map((c, i) => (
              <li key={c.cat} className={i === 4 ? "col-span-2 @[34rem]:col-span-1 [&>a]:aspect-[2.4/1] @[34rem]:[&>a]:aspect-square" : ""}>
                <a href={`${OFFICIAL}/tourism/${c.cat}/`} target="_blank" rel="noopener noreferrer" className="tap-target relative block aspect-[594/366] overflow-hidden rounded-lg @[34rem]:aspect-square">
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

      <section className="flex flex-col gap-3 @[42rem]:col-span-2">
        <div className="px-4">
          <SectionBanner>
            {w.beforeHeading}
          </SectionBanner>
        </div>
        <ul className={`${panel} flex flex-col gap-3 text-lg leading-8`}>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
            {w.before1}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
            {w.before2}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
            {w.before3}
          </li>
        </ul>
        <Notice>
          {w.beforeNotice}
        </Notice>
      </section>

      {top ? null : (
        <section className="flex flex-col gap-3 px-4 @[42rem]:col-span-2 @[42rem]:hidden">
          <SectionBanner>
            {w.startHeading}
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

      <footer className="flex flex-col gap-4 border-t-2 border-line px-4 pb-6 pt-6 @[42rem]:col-span-2">
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

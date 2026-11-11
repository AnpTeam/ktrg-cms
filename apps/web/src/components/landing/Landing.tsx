import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { IntroVideo } from "@/components/IntroVideo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Notice } from "@/components/Notice";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMap } from "@/components/landing/LandingMap";
import { LandingStory } from "@/components/landing/LandingStory";
import { Chapter, type Ground } from "@/components/landing/Chapter";
import { StoryMotion } from "@/components/landing/StoryMotion";
import { Localized } from "@/components/Localized";
import { PlaceLine } from "@/components/PlaceLine";
import { RoutePill } from "@/components/RoutePill";
import { municipalityName } from "@/lib/municipalities";
import { pickText } from "@/lib/pick-text";
import { BlogCard } from "@/components/landing/BlogCard";
import { TrailNotices } from "@/components/landing/TrailNotices";
import { useHomeWords } from "@/components/landing/useHomeWords";
import type { BannerSlide } from "@/lib/banners";
import type { RouteSummary } from "@/lib/content";
import type { HomeText } from "@/lib/home-text";
import type { TrailNotice } from "@/lib/notices";
import type { BlogPost } from "@/lib/posts";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import type { EmbedVideo } from "@/lib/video";
import { buttonStyle } from "@/components/button";

const secondary =
  buttonStyle("secondary", "lg", "flex");
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
  greeting,
  heroBody,
  text,
}: {
  locale: string;
  routes: RouteSummary[];
  notices: TrailNotice[];
  introVideo: EmbedVideo | null;
  slides: BannerSlide[];
  posts: BlogPost[];
  /** The tourism cards are shown only when an admin switched them on (管理 > 詳細設定). */
  showTourism: boolean;
  /** For a signed-in visitor: shown under the hero (and the stamp rally's explanation is left out). */
  top?: ReactNode;
  /** For a signed-in visitor: the greeting over the hero's photo, and what the band under it shows in place of signing up. */
  greeting?: ReactNode;
  heroBody?: ReactNode;
  /** What an editor wrote in place of the app's words. */
  text?: HomeText;
}) {
  const w = useHomeWords(text);
  // Grounds for the chapters after the first ones: surface, paper, surface ... in page order.
  let turn = 0;
  const ground = (): Ground => (turn++ % 2 === 0 ? "story-ground-surface" : "story-ground-paper");
  // Published courses first (only a few at first, far apart: 1 and 16), then the ones being prepared; each keeps its number.
  const firstRoutes = [...routes].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon") || a.order - b.order).slice(0, PREVIEW_ROUTES);

  return (
    // One column on a phone and a tablet; two columns on a desktop. Most sections span both. Sized by the page's own width, not
    // the screen's, so the admin's phone-shaped preview shows the phone layout on a desktop.
    <div className="@container">
    <div className="grid grid-cols-1 gap-10 @[42rem]:grid-cols-2 @[42rem]:gap-x-8">
      {/* The same photos for everyone; a signed-in visitor's greeting and progress take the line's and the buttons' place. */}
      <div className="@[42rem]:col-span-2 @[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
        <LandingHero slides={slides} locale={locale} line={w.heroLine} title={greeting}>
          {heroBody}
        </LandingHero>
      </div>

      {top ? <div className="@[42rem]:col-span-2">{top}</div> : null}

      {/* A first-time visitor: the story in chapters (what it is, the rally, where to start), edge to edge like the hero. */}
      {top ? null : (
        <div className="@[42rem]:col-span-2 @[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
          <LandingStory routes={routes} w={w} />
        </div>
      )}

      {/* Everything below, for everyone, as chapters edge to edge: each its own ground, which crossfades as it arrives
          (docs/design-language.md). Notices and the blog keep their own panels inside: safety first. */}
      <div className="@[42rem]:col-span-2 @[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
        <StoryMotion>
          {firstRoutes.length > 0 ? (
            <Chapter
              ground="story-ground-paper"
              heading={w.routesHeading}
              id="routes-title"
              wide={
                // The capsules need the full width (the photo fades in from the right); beside a vertical heading they were squeezed.
                <div className="flex flex-col gap-10">
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 @[42rem]:px-10">
                    <ul className="flex flex-col gap-3">
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
                    <div>
                      <Link href="/routes" className={`${secondary} w-full @[34rem]:w-fit`}>
                        <Trans>全{TOTAL_ROUTES}区間を見る</Trans>
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="mx-auto w-full max-w-5xl px-5 text-xl font-bold @[42rem]:px-10">{w.mapHeading}</p>
                    <LandingMap routes={routes} />
                  </div>
                </div>
              }
            >
              {null}
            </Chapter>
          ) : null}

          <div data-ground className="story-ground-paper flex flex-col gap-10 pb-20">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 @[42rem]:px-6">
              <TrailNotices notices={notices} locale={locale} limit={2} />
              <BlogCard posts={posts} locale={locale} />
            </div>
          </div>

          {top ? (
            <Chapter ground="story-ground-inverse" heading={w.storyHeading} id="story-title">
              {/* Our own wording of well-known facts. */}
              <p className="text-lg leading-9">{w.storyText}</p>
              <dl>
                <Fact term={<Trans>コース</Trans>} value={<Trans>全{TOTAL_ROUTES}区間</Trans>} />
                <Fact term={<Trans>長さ</Trans>} value={<Trans>約{TRAIL_KM}km</Trans>} />
                <Fact term={<Trans>経塚</Trans>} value={<Trans>{TOTAL_STAMPS}か所</Trans>} />
              </dl>
              <figure className="flex flex-col gap-2">
                <Image src="/home/story_img.png" alt="" width={834} height={547} sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full max-w-md rounded-lg" />
                <figcaption className="text-base opacity-90">{w.storyCaption}</figcaption>
              </figure>
            </Chapter>
          ) : null}

          {introVideo ? (
            <Chapter ground={ground()} heading={w.videoHeading} id="video-title">
              <div>
                <IntroVideo video={introVideo} title={locale === "ja" ? "葛城修験の紹介動画" : "Katsuragi Shugen introduction video"} />
                <p className="mt-2 text-base text-muted">
                  <Trans>日本遺産「葛城修験」PR動画（180秒）</Trans>
                </p>
              </div>
            </Chapter>
          ) : null}

          <Chapter ground={ground()} heading={w.officialHeading} id="official-title">
            <ul className="flex flex-col gap-3">
              {[
                { path: "/story/", label: <Trans>日本遺産 葛城修験ストーリー</Trans> },
                { path: "/about/", label: <Trans>葛城修験の基礎知識</Trans> },
                { path: "/cultural_property/", label: <Trans>構成文化財</Trans> },
              ].map((link) => (
                <li key={link.path}>
                  <a href={`${OFFICIAL}${link.path}`} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center text-xl font-bold underline underline-offset-4">
                    {link.label}
                    <span className="sr-only">
                      <Trans>（公式サイト、新しいタブで開きます）</Trans>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Chapter>

          {showTourism ? (
            <Chapter ground={ground()} heading={w.tourismHeading} id="tourism-title">
              <ul className="grid grid-cols-2 gap-3 @[34rem]:grid-cols-3">
                {[
                  { cat: "cat01", img: "/home/tourism_1.jpg", label: <Trans>観光</Trans> },
                  { cat: "cat02", img: "/home/tourism_2.jpg", label: <Trans>グルメ</Trans> },
                  { cat: "cat03", img: "/home/tourism_3.jpg", label: <Trans>お土産</Trans> },
                  { cat: "cat04", img: "/home/tourism_4.jpg", label: <Trans>体験</Trans> },
                  { cat: "cat05", img: "/home/tourism_5.jpg", label: <Trans>宿泊</Trans> },
                ].map((c) => (
                  <li key={c.cat}>
                    <a href={`${OFFICIAL}/tourism/${c.cat}/`} target="_blank" rel="noopener noreferrer" className="tap-target relative block aspect-[4/3] overflow-hidden rounded-lg">
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
            </Chapter>
          ) : null}

          <Chapter ground={ground()} heading={w.beforeHeading} id="before-title">
            <ul className="flex flex-col gap-3 text-lg leading-8">
              {[w.before1, w.before2, w.before3].map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-brand" />
                  {line}
                </li>
              ))}
            </ul>
            <Notice>{w.beforeNotice}</Notice>
          </Chapter>
        </StoryMotion>
      </div>

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
    // On the dark band: the words take the band's own colour (muted and accent red would not read there).
    <div className="flex items-baseline justify-between gap-4 border-t border-current/30 py-3">
      <dt className="text-lg opacity-90">{term}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

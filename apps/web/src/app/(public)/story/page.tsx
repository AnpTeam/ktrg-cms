import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Chapter, type Ground } from "@/components/landing/Chapter";
import { KuzuVine, SeamFade, StaffAndWaves, SutraScroll } from "@/components/landing/Decor";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { StoryMotion } from "@/components/landing/StoryMotion";
import { initLingui } from "@/i18n/server";
import { TRAIL_KM } from "@/lib/rally";
import { STORY_SECTIONS, STORY_SOURCE_URL, storyParagraph } from "@/lib/story-text";

const TITLE = { ja: "葛城修験のものがたり", en: "The story of Katsuragi Shugen" };

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: TITLE[i18n.locale === "en" ? "en" : "ja"] };
}

// Our own telling of the story (lib/story-text.ts), set as chapters like the landing (reading register, docs/design-language.md):
// each on its own ground with one of our line drawings behind it, rising in as it arrives (StoryMotion; still with reduced motion).
const LOOK: { ground: Ground; Drawing: () => React.JSX.Element }[] = [
  { ground: "story-ground-paper", Drawing: SutraScroll }, // the sutra buried at the mounds
  { ground: "story-ground-inverse", Drawing: StaffAndWaves }, // the walk starts at the sea
  { ground: "story-ground-surface", Drawing: KuzuVine }, // the villages, the kuzu vine of 葛城
  { ground: "story-ground-paper", Drawing: SutraScroll },
];

export default async function StoryPage() {
  const i18n = await initLingui();
  const locale = i18n.locale === "en" ? "en" : "ja";
  return (
    <StoryMotion className="@container">
      <ScrollProgress />
      <div className="@[42rem]:mx-[calc((100%-100vw+var(--rail))/2)]">
        <header data-ground className="story-ground-surface @container relative isolate flex flex-col gap-8 overflow-hidden -mt-3 px-5 pb-16 pt-9 md:mt-0 md:pt-6 @[42rem]:px-10 @[42rem]:pb-24">
          {/* -mt-3: on a phone the bar leaves a 12 px strip of page colour under it; the ground now starts right at the bar. */}
          <KuzuVine />
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
            <BackLink href="/">
              <Trans>ホーム</Trans>
            </BackLink>
            <h1 className="max-w-[16em] font-serif text-4xl font-bold leading-snug @[42rem]:text-6xl">{TITLE[locale]}</h1>
            <p className="max-w-[32em] text-lg text-muted">{locale === "en" ? "Katsuragi Shugen, in a few chapters." : "葛城修験を、いくつかの章で。"}</p>
          </div>
        </header>

        {STORY_SECTIONS.map((section, i) => {
          const { ground, Drawing } = LOOK[i % LOOK.length]!;
          const from = i === 0 ? "story-ground-surface" : LOOK[(i - 1) % LOOK.length]!.ground; // the opening is on surface
          return (
            <Chapter
              key={section.heading.ja}
              ground={ground}
              heading={section.heading[locale]}
              id={`story-${i}`}
              decoration={
                <>
                  <SeamFade from={from} to={ground} />
                  <Drawing />
                </>
              }
            >
              {section.paragraphs.map((p) => (
                <p key={p.ja} className="text-lg leading-9">
                  {storyParagraph(p, locale, TRAIL_KM)}
                </p>
              ))}
            </Chapter>
          );
        })}

        {/* The story ends on the team's mountains (as the landing's start chapter does), the source line standing above them. */}
        <p className="story-ground-paper relative isolate overflow-hidden px-5 pb-[clamp(9rem,34vw,22rem)] pt-10 text-base text-muted @[42rem]:px-10">
          <span aria-hidden="true" className="outro-mountains pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[clamp(7rem,30vw,20rem)]" />
          <span className="mx-auto block w-full max-w-5xl">
            {locale === "en" ? "The facts follow the official Japan Heritage site for Katsuragi Shugen: " : "内容は、日本遺産「葛城修験」の公式サイトをもとにしています。"}
            <a href={STORY_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center font-bold underline underline-offset-4">
              {locale === "en" ? "official site" : "公式サイト"}
            </a>
          </span>
        </p>
      </div>
    </StoryMotion>
  );
}

import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { initLingui } from "@/i18n/server";
import { TRAIL_KM } from "@/lib/rally";
import { STORY_SECTIONS, STORY_SOURCE_URL, storyParagraph } from "@/lib/story-text";

const TITLE = { ja: "葛城修験のものがたり", en: "The story of Katsuragi Shugen" };

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: TITLE[i18n.locale === "en" ? "en" : "ja"] };
}

// Our own telling of the story (lib/story-text.ts). Reading register: a calm column, open space between chapters, no boxes.
export default async function StoryPage() {
  const i18n = await initLingui();
  const locale = i18n.locale === "en" ? "en" : "ja";

  return (
    <div className="page-narrow flex flex-col gap-10 pb-10 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold leading-snug">{TITLE[locale]}</h1>
      </div>

      {STORY_SECTIONS.map((section, i) => (
        <section key={section.heading.ja} aria-labelledby={`story-${i}`} className="flex flex-col gap-6 px-4">
          <h2 id={`story-${i}`} className="font-serif text-2xl font-bold leading-snug">
            {section.heading[locale]}
          </h2>
          {section.paragraphs.map((p) => (
            <p key={p.ja} className="max-w-[40em] text-lg leading-9">
              {storyParagraph(p, locale, TRAIL_KM)}
            </p>
          ))}
        </section>
      ))}

      <p className="px-4 text-base text-muted">
        {locale === "en" ? "The facts follow the official Japan Heritage site for Katsuragi Shugen: " : "内容は、日本遺産「葛城修験」の公式サイトをもとにしています。"}
        <a href={STORY_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center font-bold underline underline-offset-4">
          {locale === "en" ? "official site" : "公式サイト"}
        </a>
      </p>
    </div>
  );
}

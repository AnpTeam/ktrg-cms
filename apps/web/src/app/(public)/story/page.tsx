import Image from "next/image";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Notice } from "@/components/Notice";
import { initLingui } from "@/i18n/server";
import { STORY_SECTIONS, STORY_SOURCE_URL } from "@/lib/story-copy";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`日本遺産 葛城修験ストーリー`) };
}

// The official story page, copied as it is for now and to be rewritten (docs/landing-story-design.md). Reading register:
// a calm column, open space between chapters, no boxes. The words are the source's Japanese; English visitors are told so.
export default async function StoryPage() {
  const i18n = await initLingui();
  const english = i18n.locale === "en";

  return (
    <div className="page-narrow flex flex-col gap-10 pb-10 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold leading-snug">
          <Trans>日本遺産 葛城修験ストーリー</Trans>
        </h1>
      </div>

      <Notice>
        <Trans>このページは、公式サイト「日本遺産 葛城修験ストーリー」の文章と写真を、そのまま転載したものです。仮の内容で、のちに書き直します。</Trans>
        {english ? (
          <>
            {" "}
            <Trans>文章は日本語のみです。</Trans>
          </>
        ) : null}{" "}
        <a href={STORY_SOURCE_URL} className="tap-target inline-flex items-center font-bold underline underline-offset-4">
          <Trans>元のページを見る</Trans>
        </a>
      </Notice>

      {STORY_SECTIONS.map((section, i) => (
        <section key={section.heading} aria-labelledby={`story-${i}`} lang="ja" className="flex flex-col gap-6 px-4">
          <h2 id={`story-${i}`} className="font-serif text-2xl font-bold leading-snug">
            {section.heading}
          </h2>
          {section.blocks.map((block, k) =>
            "text" in block ? (
              <p key={k} className="max-w-[40em] text-lg leading-9">
                {block.text}
              </p>
            ) : (
              <figure key={block.src} className="flex flex-col gap-2">
                <Image src={block.src} alt="" width={block.width} height={block.height} sizes="(min-width: 768px) 543px, 100vw" className="h-auto w-full max-w-[543px] rounded-lg" />
                <figcaption className="text-base text-muted">{block.caption}</figcaption>
              </figure>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

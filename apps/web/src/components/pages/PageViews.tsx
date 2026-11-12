import Link from "next/link";
import { useId } from "react";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { FaqCard, StepCard } from "@/components/pages/Cards";
import { buttonStyle } from "@/components/button";
import { Notice } from "@/components/Notice";
import { RichBody } from "@/components/RichBody";
import type { InlinePlace } from "@/components/places/PlaceInline";
import { Inlines } from "@/components/RichText";
import { SectionBanner } from "@/components/SectionBanner";
import type { Help } from "@/lib/help-content";
import type { Terms } from "@/lib/page-content";
import type { PageDoc } from "@/lib/page-text";
import { parseRich } from "@/lib/rich-text";
import type { Policy } from "@/lib/privacy-content";
import { termsContent } from "@/lib/terms-content";

// The fixed text pages, drawn from their content.

/** An editor's text: paragraphs, lists, photos and the rest of what lib/rich-text.ts reads. */
function Body({ text, places }: { text: string; places?: Record<string, InlinePlace> }) {
  const id = useId();
  return <RichBody text={text} anchor={id} places={places} />;
}

/** How to play: numbered steps and nothing else to read. */
export function GuideView({ help }: { help: Help }) {
  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/rallies">
          <Trans>ラリー</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">{help.guideTitle}</h1>
        <div className="max-w-prose whitespace-pre-line text-lg leading-8">
          <Body text={help.guideIntro} />
        </div>
      </div>
      <ol className="mx-4 flex flex-col gap-4">
        {help.steps.map((step, i) => (
          <StepCard key={i} n={i + 1} title={step.title}>
            <Body text={step.text} />
          </StepCard>
        ))}
      </ol>
      {help.guideNote ? <Notice><Inlines parts={parseRich(help.guideNote).body} /></Notice> : null}
      <div className="px-4">
        <Link href="/faq" className={buttonStyle("secondary", "lg", "flex")}>
          {help.faqTitle}
        </Link>
      </div>
    </div>
  );
}

/** Frequently asked questions: each question opens to its answer (a native <details>, so it works with the keyboard and without scripts). `open` shows every answer, for the preview. */
export function FaqView({ help, open = false }: { help: Help; open?: boolean }) {
  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/guide">
          <Trans>遊び方</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">{help.faqTitle}</h1>
      </div>
      <ul className="mx-4 flex flex-col gap-3">
        {help.faqs.map((faq, i) => (
          <li key={i}>
            <FaqCard question={faq.question} open={open}>
              <Body text={faq.answer} />
            </FaqCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Paragraph = Body;

/** The terms of use, in Japanese only unless an editor wrote an English text. English visitors are told so. */
export function TermsView({ terms: t, locale }: { terms: Terms; locale: string }) {
  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent" lang="ja">
          {t.title}
        </h1>
      </div>

      {locale === "ja" || !t.builtIn ? null : <Notice>The terms of use are available in Japanese only. They are shown below as written.</Notice>}

      {t.builtIn ? <Notice>{locale === "ja" ? "この文章は案です。公開の前に、財団が内容を確認します。" : "This text is a draft. The foundation will check it before launch."}</Notice> : null}

      <div lang={t.builtIn ? "ja" : locale === "ja" ? "ja" : "en"} className="flex flex-col gap-8">
        {t.updated ? <p className="px-4 text-lg text-muted">更新日：{t.updated}</p> : null}
        {t.lead ? <p className="px-4 text-xl font-bold">{t.lead}</p> : null}
        {t.intro.map((text, i) => (
          <div key={i} className="px-4">
            <Paragraph text={text} />
          </div>
        ))}

        {t.sections.map((section, i) => (
          <section key={i} className="flex flex-col gap-3 px-4">
            <SectionBanner>{section.heading}</SectionBanner>
            {section.paragraphs.map((text, j) => (
              <Paragraph key={j} text={text} />
            ))}
          </section>
        ))}

        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>{termsContent.creditsHeading}</SectionBanner>
          <dl className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5">
            {termsContent.credits.map((credit) => (
              <div key={credit.role}>
                <dt className="text-lg font-bold">{credit.role}</dt>
                <dd className="mt-1 text-lg leading-8">
                  {credit.name}
                  <br />
                  {credit.address}
                  {"url" in credit ? (
                    <>
                      <br />
                      <a href={credit.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                        {credit.url}
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

/** The privacy policy. */
export function PolicyView({ policy }: { policy: Policy }) {
  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">{policy.title}</h1>
      </div>
      {policy.draftNotice ? <Notice>{policy.draftNotice}</Notice> : null}
      {policy.updated ? (
        <p className="px-4 text-lg text-muted">
          <Trans>最終更新</Trans>: {policy.updated}
        </p>
      ) : null}

      {policy.sections.map((section, i) => (
        <section key={i} className="flex flex-col gap-3 px-4">
          {section.heading ? <SectionBanner>{section.heading}</SectionBanner> : null}
          {section.paragraphs?.map((text, j) => (
            <Paragraph key={j} text={text} />
          ))}
          {section.items ? (
            <dl className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5">
              {section.items.map((item) => (
                <div key={item.term}>
                  <dt className="text-lg font-bold">{item.term}</dt>
                  <dd className="mt-1 text-lg leading-8">{item.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** A page an editor made in the admin (/p/<address>). */
/** `places`: the directory places its ::place lines may name. */
export function CustomPageView({ title, doc, places }: { title: string; doc: PageDoc; places?: Record<string, InlinePlace> }) {
  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">{title}</h1>
      </div>
      {doc.lead.length > 0 ? (
        <div className="flex flex-col gap-3 px-4">
          {doc.lead.map((text, i) => (
            <Paragraph key={i} text={text} places={places} />
          ))}
        </div>
      ) : null}
      {doc.sections.map((section, i) => (
        <section key={i} className="flex flex-col gap-3 px-4">
          <SectionBanner>{section.heading}</SectionBanner>
          {section.paragraphs.map((text, j) => (
            <Paragraph key={j} text={text} places={places} />
          ))}
        </section>
      ))}
    </div>
  );
}

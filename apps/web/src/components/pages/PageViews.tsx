import Link from "next/link";
import { useId } from "react";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { buttonStyle } from "@/components/button";
import { ChevronIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { RichBody } from "@/components/RichBody";
import { Inlines } from "@/components/RichText";
import { SectionBanner } from "@/components/SectionBanner";
import type { Help } from "@/lib/help-content";
import type { Terms } from "@/lib/page-content";
import type { PageDoc } from "@/lib/page-text";
import { parseRich } from "@/lib/rich-text";
import type { Policy } from "@/lib/privacy-content";
import { termsContent } from "@/lib/terms-content";

// The fixed text pages, drawn from their content. The FAQ's and how to play's cards are drawn again in the block editor
// (LOOK in components/admin/BlockEditor.tsx): a change of look here belongs there too.

/** An editor's text: paragraphs, lists, photos and the rest of what lib/rich-text.ts reads. */
function Body({ text }: { text: string }) {
  const id = useId();
  return <RichBody text={text} anchor={id} />;
}

/** How to play: numbered steps and nothing else to read. */
export function GuideView({ help }: { help: Help }) {
  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/rallies">
          <Trans>ラリー</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{help.guideTitle}</h1>
        <div className="max-w-prose whitespace-pre-line text-lg leading-8">
          <Body text={help.guideIntro} />
        </div>
      </div>
      <ol className="mx-4 flex flex-col gap-4">
        {help.steps.map((step, i) => (
          <li key={i} className="flex gap-4 rounded-3xl bg-surface p-5">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
              {i + 1}
            </span>
            <div>
              <h2 className="text-xl font-bold leading-snug text-accent">{step.title}</h2>
              <div className="mt-1 whitespace-pre-line text-lg leading-8">
                <Body text={step.text} />
              </div>
            </div>
          </li>
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
        <h1 className="text-3xl font-bold">{help.faqTitle}</h1>
      </div>
      <ul className="mx-4 flex flex-col gap-3">
        {help.faqs.map((faq, i) => (
          <li key={i} className="rounded-3xl bg-surface">
            <details className="group" open={open}>
              <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-xl font-bold leading-snug [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span className="shrink-0 transition-transform group-open:rotate-90">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="whitespace-pre-line px-5 pb-5 text-lg leading-8">
                <Body text={faq.answer} />
              </div>
            </details>
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
        <h1 className="text-3xl font-bold" lang="ja">
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
          <dl className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
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
        <h1 className="text-3xl font-bold">{policy.title}</h1>
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
            <dl className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
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
export function CustomPageView({ title, doc }: { title: string; doc: PageDoc }) {
  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      {doc.lead.length > 0 ? (
        <div className="flex flex-col gap-3 px-4">
          {doc.lead.map((text, i) => (
            <Paragraph key={i} text={text} />
          ))}
        </div>
      ) : null}
      {doc.sections.map((section, i) => (
        <section key={i} className="flex flex-col gap-3 px-4">
          <SectionBanner>{section.heading}</SectionBanner>
          {section.paragraphs.map((text, j) => (
            <Paragraph key={j} text={text} />
          ))}
        </section>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Notice } from "@/components/Notice";
import { initLingui } from "@/i18n/server";
import { RichText } from "@/components/RichText";
import { helpFor } from "@/lib/page-text-server";
import { buttonStyle } from "@/components/button";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: (await helpFor(i18n.locale)).guideTitle };
}

// How to play: four numbered steps and nothing else to read.
export default async function GuidePage() {
  const i18n = await initLingui();
  const help = await helpFor(i18n.locale);

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/rallies">
          <Trans>ラリー</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{help.guideTitle}</h1>
        <div className="max-w-prose whitespace-pre-line text-lg leading-8">
          <RichText text={help.guideIntro} />
        </div>
      </div>
      <ol className="mx-4 flex flex-col gap-4">
        {help.steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-3xl bg-surface p-5">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
              {i + 1}
            </span>
            <div>
              <h2 className="text-xl font-bold leading-snug text-accent">{step.title}</h2>
              <div className="mt-1 whitespace-pre-line text-lg leading-8">
                <RichText text={step.text} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      {help.guideNote ? <Notice>{help.guideNote}</Notice> : null}
      <div className="px-4">
        <Link
          href="/faq"
          className={buttonStyle("secondary", "lg", "flex")}
        >
          {help.faqTitle}
        </Link>
      </div>
    </div>
  );
}

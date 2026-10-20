import type { Metadata } from "next";
import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Notice } from "@/components/Notice";
import { initLingui } from "@/i18n/server";
import { helpContent } from "@/lib/help-content";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: helpContent(i18n.locale).guideTitle };
}

// How to play: four numbered steps and nothing else to read.
export default async function GuidePage() {
  const i18n = await initLingui();
  const help = helpContent(i18n.locale);

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{help.guideTitle}</h1>
        <p className="max-w-prose text-lg leading-8">{help.guideIntro}</p>
      </div>
      <ol className="mx-4 flex flex-col gap-4">
        {help.steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-3xl bg-surface p-5">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">
              {i + 1}
            </span>
            <div>
              <h2 className="text-xl font-bold leading-snug text-accent">{step.title}</h2>
              <p className="mt-1 text-lg leading-8">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Notice>{help.guideNote}</Notice>
      <div className="px-4">
        <Link
          href="/faq"
          className="tap-target flex min-h-14 items-center justify-center rounded-xl border-2 border-brand bg-surface px-6 text-xl font-bold text-accent hover:bg-paper"
        >
          {helpContent(i18n.locale).faqTitle}
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { ChevronIcon } from "@/components/icons";
import { initLingui } from "@/i18n/server";
import { RichText } from "@/components/RichText";
import { helpFor } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: (await helpFor(i18n.locale)).faqTitle };
}

// Frequently asked questions: each question opens to its answer (a native <details>, so it works with the
// keyboard and screen readers and without scripts).
export default async function FaqPage() {
  const i18n = await initLingui();
  const help = await helpFor(i18n.locale);

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/guide">
          <Trans>遊び方</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{help.faqTitle}</h1>
      </div>
      <ul className="mx-4 flex flex-col gap-3">
        {help.faqs.map((faq) => (
          <li key={faq.question} className="rounded-3xl bg-surface">
            <details className="group">
              <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-xl font-bold leading-snug [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span className="shrink-0 transition-transform group-open:rotate-90">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="whitespace-pre-line px-5 pb-5 text-lg leading-8">
                <RichText text={faq.answer} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

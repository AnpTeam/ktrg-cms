import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Notice } from "@/components/Notice";
import { SectionBanner } from "@/components/SectionBanner";
import { initLingui } from "@/i18n/server";
import { privacyPolicy } from "@/lib/privacy-content";
import { localePath } from "@/lib/rally";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: privacyPolicy(i18n.locale).title };
}

// The policy text lives in lib/privacy-content.ts (one copy per language), not in the message catalogs: it is a
// document, and the two versions are written and checked as wholes.
export default async function PrivacyPage() {
  const i18n = await initLingui();
  const policy = privacyPolicy(i18n.locale);

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href={localePath(i18n.locale)}>
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{policy.title}</h1>
      </div>
      <Notice>{policy.draftNotice}</Notice>
      <p className="px-4 text-lg text-muted">
        <Trans>最終更新</Trans>: {policy.updated}
      </p>

      {policy.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-3 px-4">
          <SectionBanner>{section.heading}</SectionBanner>
          {section.paragraphs?.map((text) => (
            <p key={text} className="max-w-prose text-lg leading-8">
              {text}
            </p>
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

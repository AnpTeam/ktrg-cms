import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Notice } from "@/components/Notice";
import { SectionBanner } from "@/components/SectionBanner";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";
import { termsContent } from "@/lib/terms-content";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n.locale === "ja" ? termsContent.title : "Terms of use" };
}

// The terms of use, in Japanese only (the legal text is not translated). English visitors are told so.
export default async function TermsPage() {
  const i18n = await initLingui();
  const t = termsContent;

  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href={localePath(i18n.locale)}>
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold" lang="ja">
          {t.title}
        </h1>
      </div>

      {i18n.locale === "ja" ? null : (
        <Notice>The terms of use are available in Japanese only. They are shown below as written.</Notice>
      )}

      <Notice>{i18n.locale === "ja" ? "この文章は案です。公開の前に、財団が内容を確認します。" : "This text is a draft. The foundation will check it before the app is published."}</Notice>

      <div lang="ja" className="flex flex-col gap-8">
        <p className="px-4 text-lg text-muted">更新日：{t.updated}</p>
        <p className="px-4 text-xl font-bold">{t.lead}</p>
        <p className="max-w-prose px-4 text-lg leading-8">{t.intro}</p>

        {t.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3 px-4">
            <SectionBanner>{section.heading}</SectionBanner>
            {section.paragraphs.map((text) => (
              <p key={text.slice(0, 24)} className="max-w-prose text-lg leading-8">
                {text}
              </p>
            ))}
          </section>
        ))}

        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>{t.creditsHeading}</SectionBanner>
          <dl className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
            {t.credits.map((credit) => (
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

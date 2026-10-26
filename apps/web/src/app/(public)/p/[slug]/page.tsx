import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { RichText } from "@/components/RichText";
import { SectionBanner } from "@/components/SectionBanner";
import { initLingui } from "@/i18n/server";
import { customPage, customPageIn } from "@/lib/page-text-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i18n = await initLingui();
  const page = await customPage((await params).slug);
  return page ? { title: customPageIn(page, i18n.locale).title } : {};
}

// A page an editor made in the admin (管理 > ページの文章 > 新しいページ). Only published ones are found.
export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const i18n = await initLingui();
  const page = await customPage((await params).slug);
  if (!page) notFound();
  const { title, doc } = customPageIn(page, i18n.locale);
  const paragraph = (text: string) => (
    <div key={text.slice(0, 24)} className="max-w-prose whitespace-pre-line text-lg leading-8">
      <RichText text={text} />
    </div>
  );

  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      {doc.lead.length > 0 ? <div className="flex flex-col gap-3 px-4">{doc.lead.map(paragraph)}</div> : null}
      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-3 px-4">
          <SectionBanner>{section.heading}</SectionBanner>
          {section.paragraphs.map(paragraph)}
        </section>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { initLingui } from "@/i18n/server";
import { helpContent } from "@/lib/help-content";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: helpContent(i18n.locale).licensesTitle };
}

// What the app is built on and whose data it shows (the map credit is also on every map).
export default async function LicensesPage() {
  const i18n = await initLingui();
  const help = helpContent(i18n.locale);

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="font-serif text-3xl font-bold text-accent">{help.licensesTitle}</h1>
        <p className="text-lg">{help.licensesIntro}</p>
      </div>
      <dl className="mx-4 flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5">
        {help.credits.map((credit) => (
          <div key={credit.name}>
            <dt className="text-lg font-bold">{credit.name}</dt>
            <dd className="mt-1 text-lg leading-8">
              {credit.text}
              {credit.url ? (
                <>
                  {" "}
                  <a href={credit.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    {new URL(credit.url).hostname}
                  </a>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

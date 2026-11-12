import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { NoticeRows } from "@/components/landing/TrailNotices";
import { initLingui } from "@/i18n/server";
import { listNotices } from "@/lib/notices";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`お知らせ`) };
}

// Every notice in force, closures first. The home page shows only the first two and links here.
export default async function NoticesPage() {
  const i18n = await initLingui();
  const notices = await listNotices();
  return (
    <div className="flex flex-col gap-6 px-4 pt-2 wide:px-0">
      <BackLink href="/">
        <Trans>ホーム</Trans>
      </BackLink>
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-3xl font-bold text-accent">
          <Trans>お知らせ</Trans>
        </h1>
        <p className="max-w-prose text-lg leading-8 text-muted">
          <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
        </p>
      </div>
      {notices.length === 0 ? (
        <EmptyState title={<Trans>今、お知らせはありません。</Trans>}>
          <Trans>通行止めなどがあれば、ここに表示されます。</Trans>
        </EmptyState>
      ) : (
        <NoticeRows notices={notices} locale={i18n.locale} />
      )}
      <a href={`/notices/feed.xml${i18n.locale === "en" ? "?lang=en" : ""}`} className="tap-target inline-flex w-fit items-center text-base text-accent underline">
        <Trans>お知らせをフィードで受け取る</Trans>
      </a>
    </div>
  );
}

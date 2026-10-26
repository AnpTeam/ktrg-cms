import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { ChevronIcon } from "@/components/icons";
import type { PageKey, PageText } from "@/lib/page-text";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ページの文章（管理）`) };
}

/** The fixed pages whose text can be replaced: the editor sees the FAQ and how to play, an admin the terms and privacy too. */
export default async function PageTextList() {
  const i18n = await initLingui();
  const { body } = await adminGet<{ ok: true; pages: Partial<Record<PageKey, PageText | null>> }>("/settings/pages");
  const pages = body?.ok ? body.pages : {};
  const names: Record<PageKey, { name: string; hint: string }> = {
    faq: { name: i18n._(msg`よくあるご質問`), hint: i18n._(msg`質問と答えの一覧です。`) },
    guide: { name: i18n._(msg`遊び方`), hint: i18n._(msg`はじめの説明と、手順（1、2、3…）です。`) },
    terms: { name: i18n._(msg`利用規約`), hint: i18n._(msg`法的な文章です。管理者だけが直せます。`) },
    privacy: { name: i18n._(msg`プライバシーポリシー`), hint: i18n._(msg`法的な文章です。管理者だけが直せます。`) },
  };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>ページの文章</Trans>
      </h1>
      <p className="text-lg text-muted">
        <Trans>アプリにもともと入っている固定のページの文章を、ここで書きかえられます。何も書かなければ、もとの文章が表示されます。</Trans>
      </p>
      <ul className="flex flex-col gap-3">
        {(Object.keys(pages) as PageKey[]).map((key) => {
          const mine = pages[key];
          const own = !!mine && (mine.ja.body.trim() !== "" || mine.en.body.trim() !== "");
          return (
            <li key={key}>
              <Link href={`/admin/pages/${key}`} className="tap-target flex items-center justify-between gap-3 rounded-2xl bg-surface p-5 hover:bg-paper">
                <span>
                  <span className="block text-xl font-bold">{names[key].name}</span>
                  <span className="block text-base text-muted">{names[key].hint}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-base font-bold">
                  {own ? <Trans>書きかえ済み</Trans> : <Trans>もとの文章</Trans>}
                  <ChevronIcon />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

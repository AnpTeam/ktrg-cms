import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { ChevronIcon } from "@/components/icons";
import { itemName } from "@/lib/admin/lists/config";
import type { ListItem } from "@/lib/admin/lists/config";
import type { PageKey, PageText } from "@/lib/page-text";
import type { ListMeta } from "@/lib/admin/lists/config";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ページ（管理）`) };
}

/** The fixed pages whose text can be replaced: the editor sees the FAQ and how to play, an admin the terms and privacy too. */
export default async function PageTextList() {
  const i18n = await initLingui();
  const { body } = await adminGet<{ ok: true; pages: Partial<Record<PageKey, PageText | null>> }>("/settings/pages");
  const pages = body?.ok ? body.pages : {};
  const made = await adminGet<{ ok: true; items: ListItem[] }>("/lists/site-pages");
  const madePages = made.body?.ok ? made.body.items : [];
  const names: Record<PageKey, { name: string; hint: string }> = {
    home: { name: i18n._(msg`ホーム`), hint: i18n._(msg`トップページの見出しと説明です。`) },
    faq: { name: i18n._(msg`よくあるご質問`), hint: i18n._(msg`質問と答えの一覧です。`) },
    guide: { name: i18n._(msg`遊び方`), hint: i18n._(msg`はじめの説明と、手順（1、2、3…）です。`) },
    terms: { name: i18n._(msg`利用規約`), hint: i18n._(msg`法的な文章です。管理者だけが直せます。`) },
    privacy: { name: i18n._(msg`プライバシーポリシー`), hint: i18n._(msg`法的な文章です。管理者だけが直せます。`) },
  };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>ページ</Trans>
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
              <Link href={`/admin/pages/${key}`} className="tap-target flex items-center justify-between gap-3 rounded-full bg-surface p-5 hover:bg-paper">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <h2 className="text-2xl font-bold">
          <Trans>つくったページ</Trans>
        </h2>
        <Link href="/admin/site-pages/new" className="tap-target inline-flex items-center rounded-full bg-ink px-5 text-lg font-bold text-paper">
          <Trans>新しいページ</Trans>
        </Link>
      </div>
      <p className="text-lg text-muted">
        <Trans>自分でページをつくれます。公開すると、サイトの「/p/アドレス」で見られます。サイトマップにも載ります。</Trans>
      </p>
      {madePages.length > 0 ? (
        <Link href="/admin/site-pages" className="w-fit text-base font-bold text-accent underline underline-offset-4">
          <Trans>一覧で見る・削除する</Trans>
        </Link>
      ) : null}
      {madePages.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">
          <Trans>つくったページはまだありません。</Trans>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {madePages.map((item) => (
            <li key={item.id} className="p-3">
              <Link href={`/admin/site-pages/${item.id}`} className="text-xl font-bold text-accent underline underline-offset-4">
                {itemName({ titleField: "title" } as ListMeta, item, i18n.locale)}
              </Link>
              <p className="text-base text-muted">
                /p/{String(item.slug)} ・ {item.published ? <Trans>公開中</Trans> : <Trans>下書き</Trans>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

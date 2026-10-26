import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { SectionBanner } from "@/components/SectionBanner";
import { initLingui } from "@/i18n/server";
import { listRoutes, pickText } from "@/lib/content";
import { customPageIn, customPages } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`サイトマップ`) };
}

function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="tap-target flex items-center justify-between gap-3 py-1 text-lg font-bold">
        <span className="min-w-0">{children}</span>
        <ChevronIcon />
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-4">
      <SectionBanner>{title}</SectionBanner>
      <ul className="divide-y divide-line/30 rounded-3xl bg-surface px-5 py-2">{children}</ul>
    </section>
  );
}

// Every page of the app on one screen, for visitors (the search engines' list is /sitemap.xml).
export default async function SitemapPage() {
  const i18n = await initLingui();
  const routes = [...(await listRoutes())].sort((a, b) => a.order - b.order);
  const pages = await customPages();

  return (
    <div className="page-narrow flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold"><Trans>サイトマップ</Trans></h1>
      </div>

      <Group title={<Trans>ホーム</Trans>}>
        <LinkRow href="/">
          <Trans>ホーム</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>マップ</Trans>}>
        <LinkRow href="/map">
          <Trans>葛城修験の地図</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>ルート</Trans>}>
        <LinkRow href="/routes">
          <Trans>ルートの一覧</Trans>
        </LinkRow>
        {routes.map((route) => (
          <LinkRow key={route.id} href={`/routes/${route.id}`}>
            <Localized value={pickText(i18n.locale, route.nameJa, route.nameEn)} tag={false} />
          </LinkRow>
        ))}
      </Group>

      <Group title={<Trans>ラリー</Trans>}>
        <LinkRow href="/rallies">
          <Trans>ラリーとスタンプ</Trans>
        </LinkRow>
        <LinkRow href="/badges">
          <Trans>バッジ</Trans>
        </LinkRow>
        <LinkRow href="/guide">
          <Trans>遊び方</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>アカウント</Trans>}>
        <LinkRow href="/profile">
          <Trans>プロフィール</Trans>
        </LinkRow>
        <LinkRow href="/bookmarks">
          <Trans>ブックマーク</Trans>
        </LinkRow>
        <LinkRow href="/login">
          <Trans>ログイン</Trans>
        </LinkRow>
        <LinkRow href="/register">
          <Trans>新規登録</Trans>
        </LinkRow>
        <LinkRow href="/settings">
          <Trans>見やすさの設定</Trans>
        </LinkRow>
        <LinkRow href="/settings/passkeys">
          <Trans>ログインの方法</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>ご案内</Trans>}>
        <LinkRow href="/faq">
          <Trans>よくあるご質問</Trans>
        </LinkRow>
        <LinkRow href="/terms">
          <Trans>利用規約</Trans>
        </LinkRow>
        <LinkRow href="/privacy">
          <Trans>プライバシーポリシー</Trans>
        </LinkRow>
        <LinkRow href="/licenses">
          <Trans>ライセンス情報</Trans>
        </LinkRow>
        {pages.map((page) => (
          <LinkRow key={page.slug} href={`/p/${page.slug}`}>
            {customPageIn(page, i18n.locale).title}
          </LinkRow>
        ))}
      </Group>
    </div>
  );
}

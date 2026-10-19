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
import { localePath } from "@/lib/rally";

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
  const to = (path: string) => localePath(i18n.locale, path);
  const routes = [...(await listRoutes())].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href={to("")}>
          <Trans>ホーム</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold"><Trans>サイトマップ</Trans></h1>
      </div>

      <Group title={<Trans>ホーム</Trans>}>
        <LinkRow href={to("")}>
          <Trans>ホーム</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>マップ</Trans>}>
        <LinkRow href={to("/map")}>
          <Trans>葛城修験の地図</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>ルート</Trans>}>
        <LinkRow href={to("/routes")}>
          <Trans>ルートの一覧</Trans>
        </LinkRow>
        {routes.map((route) => (
          <LinkRow key={route.id} href={to(`/routes/${route.id}`)}>
            <Localized value={pickText(i18n.locale, route.nameJa, route.nameEn)} tag={false} />
          </LinkRow>
        ))}
      </Group>

      <Group title={<Trans>スタンプ</Trans>}>
        <LinkRow href={to("/stamps")}>
          <Trans>スタンプ</Trans>
        </LinkRow>
        <LinkRow href={to("/guide")}>
          <Trans>遊び方</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>アカウント</Trans>}>
        <LinkRow href={to("/login")}>
          <Trans>ログイン</Trans>
        </LinkRow>
        <LinkRow href={to("/register")}>
          <Trans>新規登録</Trans>
        </LinkRow>
        <LinkRow href={to("/settings")}>
          <Trans>見やすさの設定</Trans>
        </LinkRow>
        <LinkRow href={to("/settings/passkeys")}>
          <Trans>ログインの方法</Trans>
        </LinkRow>
      </Group>

      <Group title={<Trans>ご案内</Trans>}>
        <LinkRow href={to("/faq")}>
          <Trans>よくあるご質問</Trans>
        </LinkRow>
        <LinkRow href={to("/terms")}>
          <Trans>利用規約</Trans>
        </LinkRow>
        <LinkRow href={to("/privacy")}>
          <Trans>プライバシーポリシー</Trans>
        </LinkRow>
        <LinkRow href={to("/licenses")}>
          <Trans>ライセンス情報</Trans>
        </LinkRow>
      </Group>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import { PrefectureFilter } from "@/components/PrefectureFilter";
import { RouteRow } from "@/components/RouteRow";
import { filterByPrefecture, isPrefecture, listRoutes, prefectures } from "@/lib/content";
import { initLingui } from "@/i18n/server";
import { localePath, TOTAL_ROUTES, TRAIL_KM } from "@/lib/rally";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ルート`) };
}

// Route list (WBS 3.2.3). Content comes from the CMS through listRoutes().
export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ pref?: string }> }) {
  const i18n = await initLingui();
  const { pref } = await searchParams;
  const active = isPrefecture(pref) ? pref : undefined;

  const all = await listRoutes();
  const routes = filterByPrefecture(all, active);
  const available = prefectures.filter((p) => all.some((r) => r.prefecture === p));
  const base = localePath(i18n.locale, "/routes");

  return (
    <div className="flex flex-col gap-6">
      <section className="px-4">
        <h1 className="text-3xl font-bold">
          <Trans>ルート</Trans>
        </h1>
        <p className="mt-3 text-xl">
          <Trans>
            全{TOTAL_ROUTES}区間（約{TRAIL_KM}km）
          </Trans>
        </p>
      </section>

      <PrefectureFilter base={base} available={available} active={active} />

      {all.length === 0 ? (
        <EmptyState title={<Trans>ルートの案内は準備中です。</Trans>}>
          <Trans>公開できるようになったら、ここにルートが表示されます。</Trans>
        </EmptyState>
      ) : routes.length === 0 ? (
        <EmptyState title={<Trans>この地域のルートはまだありません。</Trans>}>
          <Link href={base} className="tap-target inline-flex items-center font-bold text-accent underline underline-offset-4">
            <Trans>すべてのルートを見る</Trans>
          </Link>
        </EmptyState>
      ) : (
        <ul>
          {routes.map((route) => (
            <li key={route.id}>
              <RouteRow route={route} href={`${base}/${route.id}`} locale={i18n.locale} />
            </li>
          ))}
        </ul>
      )}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}

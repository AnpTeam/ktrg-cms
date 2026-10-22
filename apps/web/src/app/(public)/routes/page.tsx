import Link from "next/link";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import { PrefectureFilter } from "@/components/PrefectureFilter";
import { SignInPrompt } from "@/components/SignInPrompt";
import { TrailRibbon } from "@/components/TrailRibbon";
import { filterByPrefecture, forViewer, isPrefecture, listRoutes, prefectures } from "@/lib/content";
import { completedCount, nodeState } from "@/lib/ribbon";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { TOTAL_ROUTES, TRAIL_KM } from "@/lib/rally";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ルート`) };
}

// Route list (WBS 3.2.3): the 19 routes drawn as one trail. Content comes from the CMS
// through listRoutes(); a signed-out visitor sees the same trail without any progress.
export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; as?: string }>;
}) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const { pref } = await searchParams;
  const active = isPrefecture(pref) ? pref : undefined;

  const all = (await listRoutes()).map((r) => forViewer(r, viewer));
  // Routes that are ready come first, the coming-soon ones after; each keeps its own number (route.order), and the sort is stable.
  const routes = [...filterByPrefecture(all, active)].sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon"));
  const available = prefectures.filter((p) => all.some((r) => r.prefecture === p));
  const base = "/routes";

  const done = completedCount(
    all.map((r) => nodeState({ status: r.status, stamped: r.stampedCount, total: r.spotCount })),
    viewer.signedIn,
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <section className="px-4">
        <h1 className="text-3xl font-bold lg:text-4xl">
          <Trans>葛城修験の道</Trans>
        </h1>
        <p className="mt-3 text-xl">
          <Trans>
            全{TOTAL_ROUTES}区間（約{TRAIL_KM}km）
          </Trans>
        </p>
        {done !== null ? (
          <p className="mt-1 text-xl font-bold">
            <Trans>
              歩き終えた区間 {done} / {TOTAL_ROUTES}
            </Trans>
          </p>
        ) : null}
      </section>

      <div className="lg:shrink-0">
        <PrefectureFilter base={base} available={available} active={active} />
      </div>
      </div>

      {viewer.signedIn ? null : <SignInPrompt />}

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
        <TrailRibbon routes={routes} hrefFor={(route) => `${base}/${route.id}`} locale={i18n.locale} />
      )}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}

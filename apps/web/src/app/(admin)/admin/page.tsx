import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DashboardTile } from "@/components/admin/DashboardTile";
import { GoalsForm } from "@/components/admin/GoalsForm";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { RANGES, type Overview } from "@/lib/admin/dashboard";
import { barPercent, countryName, regionName } from "@/lib/admin/visits";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ダッシュボード（管理）`) };
}

/**
 * The admin's home: the four numbers the project is judged by, each against a goal, with what the chosen range added.
 * Only an admin sees it (the API checks again); an editor goes on to the route list.
 */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer();
  if (viewer.role !== "admin") redirect("/admin/routes");

  const q = await searchParams;
  const days = RANGES.find((r) => String(r) === q.range) ?? 30;
  const { status, body } = await adminGet<({ ok: true } & Overview) | null>(`/dashboard?range=${days}`);
  const data = status === 200 && body?.ok ? body : null;
  const origins: Record<string, string> = {
    osaka: i18n._(msg`大阪府`),
    wakayama: i18n._(msg`和歌山県`),
    nara: i18n._(msg`奈良県`),
    other_japan: i18n._(msg`日本のほかの地域`),
    overseas: i18n._(msg`海外`),
  };
  const notSaid = i18n._(msg`未回答`);
  const added = i18n._(msg`この${days}日間`);
  const flagged = data?.stamps.flagged ?? 0;
  const routeMax = Math.max(0, ...(data?.stampsByRoute.map((r) => r.stamps) ?? []));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>ダッシュボード</Trans>
      </h1>
      <nav aria-label={i18n._(msg`期間`)} className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link key={r} href={`/admin?range=${r}`} aria-current={r === days ? "page" : undefined} className={`tap-target inline-flex items-center rounded-full border-2 px-5 text-lg font-bold ${r === days ? "border-ink bg-ink text-paper" : "border-line text-ink"}`}>
            {i18n._(msg`${r}日`)}
          </Link>
        ))}
      </nav>
      {!data ? (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      ) : (
        <>
          <p className="text-base text-muted">
            {data.range.from} 〜 {data.range.to}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardTile title={i18n._(msg`アクセス`)} total={data.visits.total} goal={data.goals.visits} added={data.visits.inRange} addedLabel={added} daily={data.visits.daily}>
              {data.visits.topRegion ? (
                <p className="text-base">
                  <Trans>いちばん多い地域</Trans>: <span className="font-bold">{regionName(data.visits.topRegion.country, data.visits.topRegion.region)}（{countryName(data.visits.topRegion.country, i18n.locale)}）</span>
                </p>
              ) : null}
              <Link href="/admin/visits" className="tap-target inline-flex w-fit items-center text-base font-bold text-accent underline underline-offset-4">
                <Trans>地域ごとに見る</Trans>
              </Link>
            </DashboardTile>
            <DashboardTile title={i18n._(msg`スタンプ`)} total={data.stamps.total} goal={data.goals.stamps} added={data.stamps.inRange} addedLabel={added} daily={data.stamps.daily}>
              <p className="text-base">
                <Trans>スタンプを押した人</Trans>: <span className="font-bold">{data.stamps.stampers.toLocaleString()}</span>
              </p>
              {data.stamps.flagged > 0 ? (
                <Link href="/admin/stamps" className="tap-target inline-flex w-fit items-center text-base font-bold text-accent underline underline-offset-4">
                  <Trans>確認が必要なスタンプ：{flagged}件</Trans>
                </Link>
              ) : null}
            </DashboardTile>
            <DashboardTile title={i18n._(msg`登録した人`)} total={data.signups.total} goal={data.goals.signups} added={data.signups.inRange} addedLabel={added} daily={data.signups.daily}>
              {data.signups.byOrigin.length > 0 ? (
                <p className="text-base">
                  {data.signups.byOrigin.map((o) => `${o.origin ? (origins[o.origin] ?? o.origin) : notSaid} ${o.users.toLocaleString()}`).join(" ・ ")}
                </p>
              ) : null}
            </DashboardTile>
            <DashboardTile title={i18n._(msg`ラリー達成`)} total={data.completions.total} goal={data.goals.completions} added={data.completions.inRange} addedLabel={added}>
              <p className="text-base text-muted">
                <Trans>ラリーを達成した人と回数です。同じ人が二つのラリーを達成すると、2と数えます。</Trans>
              </p>
            </DashboardTile>
          </div>
          <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <h2 className="text-xl font-bold">
              <Trans>スタンプが多いルート</Trans>
            </h2>
            {data.stampsByRoute.length === 0 ? (
              <p className="text-lg">
                <Trans>この期間のスタンプは、まだありません。</Trans>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.stampsByRoute.map((r) => (
                  <li key={r.routeId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-lg">
                      <Link href={`/admin/routes/${r.routeId}`} className="min-w-0 break-words underline underline-offset-4">
                        {r.name ?? r.routeId}
                      </Link>
                      <span className="font-bold tabular-nums">{r.stamps.toLocaleString()}</span>
                    </div>
                    <div aria-hidden="true" className="h-2 rounded-full bg-paper">
                      <div className="h-2 rounded-full bg-brand" style={{ width: `${barPercent(r.stamps, routeMax)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <details className="rounded-2xl">
            <summary className="tap-target flex w-fit cursor-pointer items-center text-lg font-bold text-accent">
              <Trans>目標を決める・変える</Trans>
            </summary>
            <div className="mt-2">
              <GoalsForm initial={data.goals} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { DailyChart, Kpi, RankedRows, ShareBar } from "@/components/admin/VisitCharts";
import { countryName, fillDays, regionName, shortPath, sharePercent, type VisitSummary } from "@/lib/admin/visits";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`アクセス解析（管理）`) };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-5">
      <h2 className="border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">{title}</h2>
      {children}
      {note ? <p className="text-base text-muted">{note}</p> : null}
    </section>
  );
}

// Where the views of the site came from: country, region (a prefecture in Japan) and city, taken from the connection by
// the host. Counts only; the privacy policy says so. The filter is a plain form, so the page is a link you can share.
export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; path?: string }> }) {
  const i18n = await initLingui();
  const q = await searchParams;
  const params = new URLSearchParams();
  if (q.from && DAY.test(q.from)) params.set("from", q.from);
  if (q.to && DAY.test(q.to)) params.set("to", q.to);
  if (q.path?.startsWith("/")) params.set("path", q.path.slice(0, 200));
  const { status, body } = await adminGet<({ ok: true } & VisitSummary) | null>(`/visits${params.size ? `?${params}` : ""}`);
  const data = status === 200 && body?.ok ? body : null;
  const unknown = i18n._(msg`不明`);
  const country = (c: string) => countryName(c, i18n.locale) || unknown;
  const region = (c: string, r: string) => regionName(c, r) || unknown;

  const unit = (n: number) => i18n._(msg`${n.toLocaleString()}回`);
  // Quick ranges end on the day the page shows (today unless a range was asked for).
  const presets = (to: string) =>
    [7, 30, 90].map((n) => ({ n, href: `?from=${new Date(Date.parse(`${to}T00:00:00Z`) - (n - 1) * 86_400_000).toISOString().slice(0, 10)}&to=${to}${q.path?.startsWith("/") ? `&path=${encodeURIComponent(q.path.slice(0, 200))}` : ""}` }));
  const days = data ? fillDays(data.daily ?? [], data.from, data.to) : [];
  const peak = days.reduce((best, d) => (d.views > best.views ? d : best), { day: "", views: 0 });
  const japan = data?.byCountry.find((c) => c.country === "JP")?.views ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-bold">
          <Trans>アクセス解析</Trans>
        </h1>
        <p className="max-w-3xl text-lg text-muted">
          <Trans>ページが開かれた回数を、接続元のおおよその地域（国・都道府県・市）ごとに数えています。IPアドレスや個人は記録しません。市や町の位置は、実際の場所とずれることがあります。</Trans>
        </p>
      </div>

      {data ? (
        <nav aria-label={i18n._(msg`期間`)} className="flex flex-wrap items-center gap-2">
          {presets(data.to).map((p) => (
            <a key={p.n} href={p.href} aria-current={data.from === p.href.slice(6, 16) ? "true" : undefined} className="tap-target inline-flex items-center rounded-full border border-line px-5 text-base font-bold hover:bg-surface aria-[current]:bg-selected aria-[current]:text-on-selected">
              {i18n._(msg`過去${p.n}日`)}
            </a>
          ))}
        </nav>
      ) : null}

      <details className="rounded-3xl bg-surface p-5" open={Boolean(q.path)}>
        <summary className="cursor-pointer text-lg font-bold">
          <Trans>期間とページをえらぶ</Trans>
        </summary>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-base font-bold">
            <Trans>はじめの日</Trans>
            <input type="date" name="from" defaultValue={data?.from ?? ""} className="tap-target rounded-full border border-line bg-paper px-3 text-lg font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-base font-bold">
            <Trans>終わりの日</Trans>
            <input type="date" name="to" defaultValue={data?.to ?? ""} className="tap-target rounded-full border border-line bg-paper px-3 text-lg font-normal" />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-base font-bold">
            <Trans>ページ（例：/routes や /rallies。空なら全部）</Trans>
            <input type="text" name="path" defaultValue={q.path ?? ""} placeholder="/routes" maxLength={200} className="tap-target rounded-full border border-line bg-paper px-3 text-lg font-normal" />
          </label>
          <button type="submit" className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper">
            <Trans>表示する</Trans>
          </button>
        </form>
      </details>

      {!data ? (
        <p role="alert" className="rounded-3xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      ) : data.total === 0 ? (
        <p className="rounded-3xl bg-surface p-6 text-lg font-bold">
          <Trans>この期間の記録は、まだありません。</Trans>
        </p>
      ) : (
        <>
          <p className="text-lg text-muted">
            {data.from} – {data.to}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={i18n._(msg`合計`)} value={data.total.toLocaleString()} note={i18n._(msg`回`)} />
            <Kpi label={i18n._(msg`1日あたり`)} value={Math.round(data.total / Math.max(1, days.length)).toLocaleString()} note={i18n._(msg`回`)} />
            <Kpi label={i18n._(msg`いちばん多い日`)} value={peak.views.toLocaleString()} note={peak.day} />
            <Kpi label={i18n._(msg`日本から`)} value={`${sharePercent(japan, data.total)}%`} note={unit(japan)} />
          </div>

          <Block title={i18n._(msg`日ごとのアクセス`)}>
            <DailyChart days={days} label={i18n._(msg`日ごとのアクセス`)} />
          </Block>

          <div className="grid gap-6 lg:grid-cols-2">
            <Block title={i18n._(msg`国`)}>
              <ShareBar rows={data.byCountry.map((r) => ({ key: r.country, label: country(r.country), views: r.views }))} total={data.total} restLabel={i18n._(msg`その他`)} unit={unit} />
            </Block>
            <Block title={i18n._(msg`よく見られたページ`)}>
              <RankedRows rows={data.topPages.map((r) => ({ key: r.path, label: shortPath(r.path), views: r.views }))} total={data.total} unit={unit} more={i18n._(msg`もっと見る`)} />
            </Block>
            <Block title={i18n._(msg`地域（日本は都道府県）`)}>
              <RankedRows rows={data.byRegion.slice(0, 30).map((r) => ({ key: `${r.country}/${r.region}`, label: `${country(r.country)} ${region(r.country, r.region)}`, views: r.views }))} total={data.total} unit={unit} more={i18n._(msg`もっと見る`)} />
            </Block>
            <Block title={i18n._(msg`市・町`)} note={i18n._(msg`${data.minCityViews}回に満たない市・町は、名前を出さず合計だけにしています（${data.hiddenCityViews}回）。`)}>
              <RankedRows rows={data.byCity.slice(0, 50).map((r) => ({ key: `${r.country}/${r.region}/${r.city}`, label: `${r.city}（${region(r.country, r.region)}）`, views: r.views }))} total={data.total} unit={unit} more={i18n._(msg`もっと見る`)} />
            </Block>
          </div>
        </>
      )}
    </div>
  );
}

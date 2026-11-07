import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { barPercent, countryName, regionName, type VisitSummary } from "@/lib/admin/visits";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`アクセス解析（管理）`) };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function Rows({ rows }: { rows: { key: string; label: string; views: number }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.views));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-lg">
            <span className="min-w-0 break-all">{r.label}</span>
            <span className="font-bold tabular-nums">{r.views.toLocaleString()}</span>
          </div>
          <div aria-hidden="true" className="h-2 rounded-full bg-surface">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${barPercent(r.views, max)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <h2 className="text-xl font-bold">{title}</h2>
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>アクセス解析</Trans>
      </h1>
      <p className="text-lg text-muted">
        <Trans>ページが開かれた回数を、接続元のおおよその地域（国・都道府県・市）ごとに数えています。IPアドレスや個人は記録しません。市や町の位置は、実際の場所とずれることがあります。</Trans>
      </p>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4">
        <label className="flex flex-col gap-1 text-base font-bold">
          <Trans>はじめの日</Trans>
          <input type="date" name="from" defaultValue={data?.from ?? ""} className="tap-target rounded-xl border-2 border-line bg-paper px-3 text-lg font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-base font-bold">
          <Trans>終わりの日</Trans>
          <input type="date" name="to" defaultValue={data?.to ?? ""} className="tap-target rounded-xl border-2 border-line bg-paper px-3 text-lg font-normal" />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-base font-bold">
          <Trans>ページ（例：/routes や /rallies。空なら全部）</Trans>
          <input type="text" name="path" defaultValue={q.path ?? ""} placeholder="/routes" maxLength={200} className="tap-target rounded-xl border-2 border-line bg-paper px-3 text-lg font-normal" />
        </label>
        <button type="submit" className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper">
          <Trans>表示する</Trans>
        </button>
      </form>
      {!data ? (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      ) : (
        <>
          <p className="text-2xl font-bold">
            <Trans>
              {data.from} から {data.to} まで：{data.total.toLocaleString()} 回
            </Trans>
          </p>
          {data.total === 0 ? (
            <p className="rounded-2xl bg-surface p-6 text-lg font-bold">
              <Trans>この期間の記録は、まだありません。</Trans>
            </p>
          ) : (
            <>
              <Block title={i18n._(msg`国`)}>
                <Rows rows={data.byCountry.map((r) => ({ key: r.country, label: country(r.country), views: r.views }))} />
              </Block>
              <Block title={i18n._(msg`地域（日本は都道府県）`)}>
                <Rows rows={data.byRegion.slice(0, 30).map((r) => ({ key: `${r.country}/${r.region}`, label: `${country(r.country)} ${region(r.country, r.region)}`, views: r.views }))} />
              </Block>
              <Block
                title={i18n._(msg`市・町`)}
                note={i18n._(msg`${data.minCityViews}回に満たない市・町は、名前を出さず合計だけにしています（${data.hiddenCityViews}回）。`)}
              >
                <Rows rows={data.byCity.slice(0, 50).map((r) => ({ key: `${r.country}/${r.region}/${r.city}`, label: `${r.city}（${region(r.country, r.region)}）`, views: r.views }))} />
              </Block>
              <Block title={i18n._(msg`よく見られたページ`)}>
                <Rows rows={data.topPages.map((r) => ({ key: r.path, label: r.path, views: r.views }))} />
              </Block>
            </>
          )}
        </>
      )}
    </div>
  );
}

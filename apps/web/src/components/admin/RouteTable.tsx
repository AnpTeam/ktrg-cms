"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { checklist, factsFromSummary, progress } from "@/lib/admin/checklist";
import { filterRoutes, moveId, routeState, type RouteState } from "@/lib/admin/route-list";
import { RouteImport } from "./RouteImport";
import { useChecklistLabels } from "./useChecklistLabels";
import type { AdminRouteSummary, Prefecture } from "@/lib/admin/types";
import { formatUpdated } from "@/lib/format";

const PREFECTURES: Prefecture[] = ["osaka", "wakayama", "nara"];

// The list of routes in walking order: search, narrow by prefecture, move a route earlier or later, open one.
export function RouteTable({ initial, locale }: { initial: AdminRouteSummary[]; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [routes, setRoutes] = useState(initial);
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState<Prefecture | null>(null);
  const [needsWorkOnly, setNeedsWorkOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const labels = useChecklistLabels();

  const stateLabel: Record<RouteState, string> = { soon: t`準備中`, draft: t`下書き`, published: t`公開中` };
  const prefName: Record<Prefecture, string> = { osaka: t`大阪府`, wakayama: t`和歌山県`, nara: t`奈良県` };
  const items = useMemo(() => new Map(routes.map((r) => [r.id, checklist(factsFromSummary(r))])), [routes]);
  const needsWork = (id: string) => progress(items.get(id) ?? []).needsWork;
  const needsWorkCount = routes.filter((r) => needsWork(r.id)).length;
  const shown = useMemo(
    () => filterRoutes(routes, query, prefecture).filter((r) => !needsWorkOnly || progress(items.get(r.id) ?? []).needsWork),
    [routes, query, prefecture, needsWorkOnly, items],
  );
  const filtering = query.trim() !== "" || prefecture !== null || needsWorkOnly;

  async function move(id: string, step: -1 | 1) {
    if (busy) return;
    const before = routes;
    const ids = moveId(routes.map((r) => r.id), id, step);
    const byId = new Map(routes.map((r) => [r.id, r]));
    setRoutes(ids.map((i) => byId.get(i)!));
    setBusy(true);
    setError(null);
    const res = await outcome(api.admin.routes.order.put({ ids }));
    if (!res.ok) {
      setRoutes(before); // the order on screen must be the order that was saved
      setError(messages[res.key]);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-base font-bold">
          {t`ルートをさがす`}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t`名前の一部を入力`}
            className="tap-target rounded-xl border-2 border-line bg-paper px-4 text-lg font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-base font-bold">
          {t`都道府県`}
          <select
            value={prefecture ?? ""}
            onChange={(e) => setPrefecture((e.target.value || null) as Prefecture | null)}
            className="tap-target rounded-xl border-2 border-line bg-paper px-3 text-lg font-normal"
          >
            <option value="">{t`すべて`}</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {prefName[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="tap-target flex items-center gap-2 text-base font-bold">
          <input type="checkbox" checked={needsWorkOnly} onChange={(e) => setNeedsWorkOnly(e.target.checked)} className="size-6" />
          {t`手直しが必要なルートだけ（${needsWorkCount}）`}
        </label>
        <Link href="/admin/routes/new" className="tap-target inline-flex items-center rounded-xl bg-ink px-5 text-lg font-bold text-paper">
          {t`新しいルート`}
        </Link>
      </div>

      <RouteImport routes={routes} onImported={setRoutes} />

      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}

      {routes.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`ルートがまだありません。「新しいルート」から作ってください。`}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`条件に合うルートがありません。`}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {shown.map((r) => {
            const index = routes.findIndex((x) => x.id === r.id);
            const name = locale === "en" && r.nameEn ? r.nameEn : r.nameJa;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/routes/${r.id}`} className="text-xl font-bold text-accent underline underline-offset-4">
                    {name}
                  </Link>
                  <p className="text-base text-muted">
                    {r.prefecture ? prefName[r.prefecture] : t`都道府県が未入力`}
                    {" ・ "}
                    {stateLabel[routeState(r)]}
                    {" ・ "}
                    {t`スタンプの経由地 ${r.publishedSpotCount} / ${r.spotCount}`}
                    {" ・ "}
                    {t`更新 ${formatUpdated(locale, r.updatedAt)}`}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={t`足りないもの`}>
                    {(items.get(r.id) ?? [])
                      .filter((i) => !i.done)
                      .map((i) => (
                        <li key={i.id}>
                          <Link
                            href={`/admin/routes/${r.id}?tab=${i.tab}`}
                            className={`inline-flex items-center rounded-md px-3 py-1 text-base ${i.required ? "bg-danger font-bold text-white" : "bg-surface text-ink"}`}
                          >
                            {i.required ? t`必要：${labels.item[i.id]}` : t`あるとよい：${labels.item[i.id]}`}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || filtering || index === 0}
                    onClick={() => move(r.id, -1)}
                    aria-label={t`${name} を1つ前へ`}
                    className="tap-target min-w-14 rounded-xl border-2 border-line px-3 text-base font-bold disabled:opacity-40"
                  >
                    {t`前へ`}
                  </button>
                  <button
                    type="button"
                    disabled={busy || filtering || index === routes.length - 1}
                    onClick={() => move(r.id, 1)}
                    aria-label={t`${name} を1つ後ろへ`}
                    className="tap-target min-w-14 rounded-xl border-2 border-line px-3 text-base font-bold disabled:opacity-40"
                  >
                    {t`後ろへ`}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {filtering && routes.length > 0 ? <p className="text-base text-muted">{t`並べ替えは、検索や絞り込みを外してからできます。`}</p> : null}
    </div>
  );
}

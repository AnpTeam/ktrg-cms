"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pager } from "@/components/Pager";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { checklist, factsFromSummary, progress } from "@/lib/admin/checklist";
import { nextSort, sortBy, type Sort } from "@/lib/admin/lists/sort";
import { filterRoutes, moveId, routeState, type RouteState } from "@/lib/admin/route-list";
import { Chip } from "./Chip";
import { FilterGroup, HeaderFilter, MoveButtons, OrderBadge, SortHeader } from "./list-parts";
import { RouteImport } from "./RouteImport";
import { useChecklistLabels } from "./useChecklistLabels";
import type { AdminRouteSummary, Prefecture } from "@/lib/admin/types";
import { formatUpdated } from "@/lib/format";
import { pageCount, pageSlice } from "@/lib/pager";

const PREFECTURES: Prefecture[] = ["osaka", "wakayama", "nara"];
const STATES: RouteState[] = ["published", "draft", "soon"];
// How many routes fit on one page; the pager is hidden while they all do.
const PAGE = 25;

// The list of routes in walking order, as a table (a card per route on a phone): search, narrow by prefecture and state,
// sort by a column, move a route earlier or later, open one. Moving is only possible in the walking order itself, so it is
// off while a filter or a sort is on.
export function RouteTable({ initial, locale }: { initial: AdminRouteSummary[]; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [routes, setRoutes] = useState(initial);
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState<Prefecture | null>(null);
  const [state, setState] = useState<RouteState | null>(null);
  const [needsWorkOnly, setNeedsWorkOnly] = useState(false);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const labels = useChecklistLabels();

  const stateLabel: Record<RouteState, string> = { soon: t`準備中`, draft: t`下書き`, published: t`公開中` };
  const prefName: Record<Prefecture, string> = { osaka: t`大阪府`, wakayama: t`和歌山県`, nara: t`奈良県` };
  const items = useMemo(() => new Map(routes.map((r) => [r.id, checklist(factsFromSummary(r))])), [routes]);
  const needsWork = (id: string) => progress(items.get(id) ?? []).needsWork;
  const needsWorkCount = routes.filter((r) => needsWork(r.id)).length;
  const name = (r: AdminRouteSummary) => (locale === "en" && r.nameEn ? r.nameEn : r.nameJa);
  const order = useMemo(() => new Map(routes.map((r, i) => [r.id, i + 1])), [routes]);

  const filtered = useMemo(
    () => filterRoutes(routes, query, prefecture).filter((r) => (state === null || routeState(r) === state) && (!needsWorkOnly || progress(items.get(r.id) ?? []).needsWork)),
    [routes, query, prefecture, state, needsWorkOnly, items],
  );
  const shown = useMemo(() => {
    if (sort === null) return filtered;
    const value: Record<string, (r: AdminRouteSummary) => string | number | null> = {
      order: (r) => order.get(r.id) ?? null,
      name: (r) => name(r),
      prefecture: (r) => (r.prefecture ? prefName[r.prefecture] : null),
      state: (r) => STATES.indexOf(routeState(r)),
      spots: (r) => r.publishedSpotCount,
      updated: (r) => r.updatedAt,
    };
    return sortBy(filtered, sort.dir, value[sort.key] ?? (() => null), locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name and prefName only read the locale
  }, [filtered, sort, order, locale]);
  const filtering = query.trim() !== "" || prefecture !== null || state !== null || needsWorkOnly;
  const canMove = !filtering && sort === null;
  const pages = pageCount(shown.length, PAGE);
  const here = Math.min(page, pages); // a filter can leave fewer pages than the one we were on
  const visible = pageSlice(shown, here, PAGE);

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

  // What the route still lacks: each required item is a pill of its own (the person must act on those); the nice-to-have
  // ones are folded into one pill with a count, so a route with many of them does not make a tall row.
  const missing = (r: AdminRouteSummary) => {
    const open = (items.get(r.id) ?? []).filter((i) => !i.done);
    const wanted = open.filter((i) => !i.required);
    const pill = (key: string, tab: string, tone: "bad" | "neutral", text: string, title?: string) => (
      <li key={key}>
        <Link href={`/admin/routes/${r.id}?tab=${tab}`} title={title} className="inline-flex rounded-full no-underline hover:opacity-80">
          <Chip tone={tone}>{text}</Chip>
        </Link>
      </li>
    );
    return [
      ...open.filter((i) => i.required).map((i) => pill(i.id, i.tab, "bad", t`必要：${labels.item[i.id]}`)),
      ...(wanted.length ? [pill("wanted", wanted[0]!.tab, "neutral", t`あるとよい ${wanted.length}`, wanted.map((i) => labels.item[i.id]).join("、"))] : []),
    ];
  };
  const stateChip = (r: AdminRouteSummary) => <Chip tone={routeState(r) === "published" ? "good" : "neutral"}>{stateLabel[routeState(r)]}</Chip>;
  const onSort = (key: string) => {
    setSort(nextSort(sort, key));
    setPage(1);
  };
  const prefOptions = PREFECTURES.map((p) => ({ value: p, text: prefName[p] }));
  const stateOptions = STATES.map((s) => ({ value: s, text: stateLabel[s] }));
  const pickPrefecture = (v: string) => {
    setPrefecture((v || null) as Prefecture | null);
    setPage(1);
  };
  const pickState = (v: string) => {
    setState((v || null) as RouteState | null);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-base font-bold">
          {t`ルートをさがす`}
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t`名前の一部を入力`} className="tap-target rounded-xl border-2 border-line bg-paper px-4 text-lg font-normal" />
        </label>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3 md:hidden">
        <FilterGroup label={t`都道府県`} options={prefOptions} value={prefecture ?? ""} onChange={pickPrefecture} />
        <FilterGroup label={t`状態`} options={stateOptions} value={state ?? ""} onChange={pickState} />
        <button
          type="button"
          aria-pressed={needsWorkOnly}
          onClick={() => {
            setNeedsWorkOnly(!needsWorkOnly);
            setPage(1);
          }}
          className={`tap-target w-fit rounded-full border-2 px-4 text-base font-bold ${needsWorkOnly ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"}`}
        >
          {t`手直しが必要なルートだけ（${needsWorkCount}）`}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4">
        <p className="text-base font-bold text-muted" aria-live="polite">
          {t`${shown.length}件`}
        </p>
        <RouteImport routes={routes} onImported={setRoutes} />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}

      {routes.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`ルートがまだありません。「新しいルート」から作ってください。`}</p>
      ) : (
        <>
          <div className="relative hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface align-top text-base">
                <tr>
                  <SortHeader label={t`順`} sortKey="order" sort={sort} onSort={onSort} />
                  <SortHeader label={t`名前`} sortKey="name" sort={sort} onSort={onSort} />
                  <SortHeader label={t`都道府県`} sortKey="prefecture" sort={sort} onSort={onSort} filter={<HeaderFilter label={t`都道府県`} options={prefOptions} value={prefecture ?? ""} onChange={pickPrefecture} />} />
                  <SortHeader label={t`状態`} sortKey="state" sort={sort} onSort={onSort} filter={<HeaderFilter label={t`状態`} options={stateOptions} value={state ?? ""} onChange={pickState} />} />
                  <SortHeader label={t`公開中の経由地`} sortKey="spots" sort={sort} onSort={onSort} />
                  <th scope="col" className="p-0 font-bold">
                    <div className="tap-target flex items-center px-3">{t`足りないもの`}</div>
                    <div className="px-3 pb-2">
                      <HeaderFilter label={t`足りないもの`} options={[{ value: "yes", text: t`手直しが必要（${needsWorkCount}）` }]} value={needsWorkOnly ? "yes" : ""} onChange={(v) => { setNeedsWorkOnly(v === "yes"); setPage(1); }} />
                    </div>
                  </th>
                  <SortHeader label={t`更新`} sortKey="updated" sort={sort} onSort={onSort} />
                  <th scope="col" className="w-16 p-3">
                    <span className="sr-only">{t`並べ替え`}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-lg">
                      {t`条件に合うルートがありません。`}
                    </td>
                  </tr>
                ) : null}
                {visible.map((r) => {
                  const index = order.get(r.id)! - 1;
                  return (
                    <tr key={r.id} className="align-top hover:bg-surface/60">
                      <td className="p-3">
                        <OrderBadge n={index + 1} />
                      </td>
                      <td className="max-w-72 p-3">
                        <Link href={`/admin/routes/${r.id}`} className="break-words text-lg font-bold text-accent underline underline-offset-4">
                          {name(r)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap p-3 text-lg">{r.prefecture ? prefName[r.prefecture] : <span className="text-muted">{t`未入力`}</span>}</td>
                      <td className="p-3">{stateChip(r)}</td>
                      <td className="whitespace-nowrap p-3 text-lg tabular-nums">
                        {r.publishedSpotCount} / {r.spotCount}
                      </td>
                      <td className="p-3">
                        <ul className="flex flex-wrap gap-1.5" aria-label={t`足りないもの`}>
                          {missing(r)}
                        </ul>
                      </td>
                      <td className="whitespace-nowrap p-3 text-base text-muted">{formatUpdated(locale, r.updatedAt)}</td>
                      <td className="p-3">
                        <MoveButtons name={name(r)} canEarlier={canMove && index > 0} canLater={canMove && index < routes.length - 1} onMove={(step) => void move(r.id, step)} busy={busy} stacked />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 ? <p className="rounded-2xl bg-surface p-6 text-lg md:hidden">{t`条件に合うルートがありません。`}</p> : null}
          <ol className={`flex-col divide-y divide-line rounded-2xl border border-line md:hidden ${shown.length === 0 ? "hidden" : "flex"}`}>
            {visible.map((r) => {
              const index = order.get(r.id)! - 1;
              return (
                <li key={r.id} className="flex flex-col gap-2 p-3">
                  <div className="flex items-center gap-3">
                    <OrderBadge n={index + 1} />
                    <Link href={`/admin/routes/${r.id}`} className="min-w-0 flex-1 break-words text-xl font-bold text-accent underline underline-offset-4">
                      {name(r)}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {stateChip(r)}
                    <span className="text-base">{r.prefecture ? prefName[r.prefecture] : t`都道府県が未入力`}</span>
                    <span className="text-base">
                      <span className="text-muted">{t`公開中の経由地`}: </span>
                      {r.publishedSpotCount} / {r.spotCount}
                    </span>
                    <span className="text-base text-muted">{t`更新 ${formatUpdated(locale, r.updatedAt)}`}</span>
                  </div>
                  <ul className="flex flex-wrap gap-1.5" aria-label={t`足りないもの`}>
                    {missing(r)}
                  </ul>
                  <MoveButtons name={name(r)} canEarlier={canMove && index > 0} canLater={canMove && index < routes.length - 1} onMove={(step) => void move(r.id, step)} busy={busy} />
                </li>
              );
            })}
          </ol>
        </>
      )}
      <Pager page={here} pages={pages} onPage={setPage} disabled={busy} hideWhenSingle />
      {!canMove && routes.length > 0 ? <p className="text-base text-muted">{t`並べ替えは、検索・絞り込み・並べかえを外してからできます。`}</p> : null}
    </div>
  );
}

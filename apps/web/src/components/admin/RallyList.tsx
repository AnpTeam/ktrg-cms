"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pager } from "@/components/Pager";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { nextSort, sortBy, type Sort } from "@/lib/admin/lists/sort";
import { moveId } from "@/lib/admin/route-list";
import type { AdminRally } from "@/lib/admin/types";
import { formatUpdated } from "@/lib/format";
import { pageCount, pageSlice } from "@/lib/pager";
import { Chip } from "./Chip";
import { FilterGroup, MoveButtons, OrderBadge, SortHeader } from "./list-parts";

// How many rallies fit on one page; the pager is hidden while they all do.
const PAGE = 25;

// Every rally in the order visitors see them, as a table (a card per rally on a phone): its type, whether it is public, how
// much is in it, how many finished. 前へ / 後ろへ save the order at once (only while no filter or sort is on); 新しいラリー
// opens the form that picks places or courses.
export function RallyList({ initial, locale }: { initial: AdminRally[]; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [rallies, setRallies] = useState(initial);
  const [kind, setKind] = useState("");
  const [published, setPublished] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (r: AdminRally) => (locale === "en" && r.nameEn ? r.nameEn : r.nameJa);
  const order = useMemo(() => new Map(rallies.map((r, i) => [r.id, i + 1])), [rallies]);
  const kindLabel = (r: AdminRally) => (r.kind === "places" ? t`経由地のラリー` : t`コースのラリー`);
  const memberLabel = (r: AdminRally) => (r.kind === "places" ? t`経由地 ${r.memberCount}` : t`コース ${r.memberCount}`);

  const filtered = rallies.filter((r) => (kind === "" || r.kind === kind) && (published === "" || String(r.published) === published));
  const shown = useMemo(() => {
    if (sort === null) return filtered;
    const value: Record<string, (r: AdminRally) => string | number | null> = {
      order: (r) => order.get(r.id) ?? null,
      name: (r) => name(r),
      kind: (r) => r.kind,
      members: (r) => r.memberCount,
      state: (r) => (r.published ? 0 : 1),
      completions: (r) => r.completionCount,
      updated: (r) => r.updatedAt,
    };
    return sortBy(filtered, sort.dir, value[sort.key] ?? (() => null), locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `name` only reads the locale
  }, [filtered, sort, order, locale]);
  const canMove = kind === "" && published === "" && sort === null;
  const pages = pageCount(shown.length, PAGE);
  const here = Math.min(page, pages); // a filter can leave fewer pages than the one we were on
  const visible = pageSlice(shown, here, PAGE);
  const onSort = (key: string) => {
    setSort(nextSort(sort, key));
    setPage(1);
  };
  const stateChip = (r: AdminRally) => <Chip tone={r.published ? "good" : "neutral"}>{r.published ? t`公開中` : t`下書き`}</Chip>;

  async function move(id: string, step: -1 | 1) {
    if (busy) return;
    const before = rallies;
    const ids = moveId(rallies.map((r) => r.id), id, step);
    const byId = new Map(rallies.map((r) => [r.id, r]));
    setRallies(ids.map((i) => byId.get(i)!));
    setBusy(true);
    setError(null);
    const res = await outcome(api.admin.rallies.order.put({ ids }));
    if (!res.ok) {
      setRallies(before); // the order on screen must be the order that was saved
      setError(messages[res.key]);
    }
    setBusy(false);
  }

  const mover = (r: AdminRally) => {
    const index = order.get(r.id)! - 1;
    return <MoveButtons name={name(r)} canEarlier={canMove && index > 0} canLater={canMove && index < rallies.length - 1} onMove={(step) => void move(r.id, step)} busy={busy} />;
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/rallies/new" className="tap-target inline-flex w-fit items-center rounded-xl bg-ink px-5 text-lg font-bold text-paper">
        {t`新しいラリー`}
      </Link>
      {rallies.length > 1 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3">
          <FilterGroup label={t`種類`} options={[{ value: "places", text: t`経由地のラリー` }, { value: "course", text: t`コースのラリー` }]} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
          <FilterGroup label={t`状態`} options={[{ value: "true", text: t`公開中` }, { value: "false", text: t`下書き` }]} value={published} onChange={(v) => { setPublished(v); setPage(1); }} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-surface p-4 text-lg font-bold text-danger">
          {error}
        </p>
      ) : null}
      {rallies.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`ラリーがまだありません。「新しいラリー」から作ってください。`}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg">{t`条件に合うラリーがありません。`}</p>
      ) : (
        <>
          <p className="text-base font-bold text-muted" aria-live="polite">
            {t`${shown.length}件`}
          </p>
          <div className="relative hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface text-base">
                <tr>
                  <SortHeader label={t`順`} sortKey="order" sort={sort} onSort={onSort} />
                  <SortHeader label={t`名前`} sortKey="name" sort={sort} onSort={onSort} />
                  <SortHeader label={t`種類`} sortKey="kind" sort={sort} onSort={onSort} />
                  <SortHeader label={t`中身`} sortKey="members" sort={sort} onSort={onSort} />
                  <SortHeader label={t`状態`} sortKey="state" sort={sort} onSort={onSort} />
                  <SortHeader label={t`達成した人`} sortKey="completions" sort={sort} onSort={onSort} />
                  <SortHeader label={t`更新`} sortKey="updated" sort={sort} onSort={onSort} />
                  <th scope="col" className="w-40 p-3">
                    <span className="sr-only">{t`並べ替え`}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface/60">
                    <td className="p-3">
                      <OrderBadge n={order.get(r.id)!} />
                    </td>
                    <td className="max-w-72 p-3">
                      <Link href={`/admin/rallies/${r.id}`} className="break-words text-lg font-bold text-accent underline underline-offset-4">
                        {name(r)}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Chip>{kindLabel(r)}</Chip>
                    </td>
                    <td className="p-3 text-lg tabular-nums">{memberLabel(r)}</td>
                    <td className="p-3">{stateChip(r)}</td>
                    <td className="p-3 text-lg tabular-nums">{r.completionCount.toLocaleString()}</td>
                    <td className="p-3 text-base text-muted">{formatUpdated(locale, r.updatedAt)}</td>
                    <td className="p-3">{mover(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line md:hidden">
            {visible.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-3">
                  <OrderBadge n={order.get(r.id)!} />
                  <Link href={`/admin/rallies/${r.id}`} className="min-w-0 flex-1 break-words text-xl font-bold text-accent underline underline-offset-4">
                    {name(r)}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {stateChip(r)}
                  <Chip>{kindLabel(r)}</Chip>
                  <span className="text-base">{memberLabel(r)}</span>
                  <span className="text-base">{t`達成した人 ${r.completionCount}`}</span>
                </div>
                {mover(r)}
              </li>
            ))}
          </ol>
        </>
      )}
      <Pager page={here} pages={pages} onPage={setPage} disabled={busy} hideWhenSingle />
      {!canMove && rallies.length > 0 ? <p className="text-base text-muted">{t`並べ替えは、絞り込み・並べかえを外してからできます。`}</p> : null}
    </div>
  );
}

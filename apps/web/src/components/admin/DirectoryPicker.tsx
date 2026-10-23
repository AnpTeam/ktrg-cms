"use client";

import { useCallback, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { useCategoryNames } from "@/components/map/PlacesPanel";
import { pickList, type DirectoryPlace } from "@/lib/admin/directory-pick";
import { listRequest, type ListPage, type OneItem } from "@/lib/admin/lists/list-client";
import type { ErrorKey } from "@/lib/api-error";
import { distanceLabel, placeCategories, type Coord } from "@/lib/places";

const chip = "inline-flex h-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-line bg-paper px-3 text-sm font-bold hover:bg-surface disabled:opacity-40";

/** A directory row as the admin list sends it, with what the manager needs. */
interface Row extends DirectoryPlace {
  updatedAt: string;
  routeId: string | null;
  published: boolean;
}

const rowOf = (it: Record<string, unknown>): Row => ({
  id: String(it.id),
  category: String(it.category ?? "other"),
  nameJa: String(it.nameJa ?? ""),
  nameEn: typeof it.nameEn === "string" ? it.nameEn : null,
  lat: typeof it.lat === "number" ? it.lat : Number.NaN,
  lng: typeof it.lng === "number" ? it.lng : Number.NaN,
  address: typeof it.address === "string" ? it.address : null,
  updatedAt: String(it.updatedAt ?? ""),
  routeId: typeof it.routeId === "string" ? it.routeId : null,
  published: it.published === true,
});

/**
 * The "nearby places" of a route: places of the site's directory (parking, vending machines, toilets ...) whose "nearby
 * route" is this one. They are listed on the route's page, open in a small window there, and sit on the big map. A place
 * is linked here, not copied: changes in the directory show up at once, and "unlink" only clears its route. These changes
 * are saved straight away (they belong to the places, not to the route form).
 */
export function NearbyPlacesManager({ routeId, from }: { routeId: string; from: Coord | null }) {
  const { t } = useLingui();
  const names = useCategoryNames();
  const messages = useErrorMessages();
  const [linked, setLinked] = useState<Row[] | null>(null);
  const [all, setAll] = useState<Row[] | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [category, setCategory] = useState("parking");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [mine, every] = await Promise.all([
      listRequest<ListPage>("GET", `directory?filter=${encodeURIComponent(`routeId:${routeId}`)}`),
      listRequest<ListPage>("GET", "directory"),
    ]);
    if (mine.ok) setLinked(mine.data.items.map(rowOf));
    else setError(mine.key);
    if (every.ok) setAll(every.data.items.map(rowOf));
  }, [routeId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function link(row: Row, to: string | null) {
    setBusy(row.id);
    setError(null);
    const res = await listRequest<OneItem>("PATCH", `directory/${row.id}`, { updatedAt: row.updatedAt, routeId: to });
    setBusy(null);
    if (!res.ok) return setError(res.key);
    await load();
  }

  const candidates = (all ?? []).filter((p) => p.routeId !== routeId);
  const rows = pickList(
    candidates.filter((p) => Number.isFinite(p.lat)),
    { from, category, query },
  ) as (Row & { meters: number | null })[];
  const distance = (meters: number | null) => {
    if (meters === null) return null;
    const d = distanceLabel(meters);
    const amount = d.amount;
    const unit = d.unit;
    return t`${amount}${unit}`;
  };

  return (
    <section aria-label={t`周辺の場所`} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
      <h3 className="text-lg font-bold">{t`周辺の場所（駐車場・自販機・トイレなど）`}</h3>
      <p className="text-base text-muted">{t`場所一覧の場所を、このルートにひもづけます。ルートのページに「周辺の場所」として並び、大きな地図にもピンが出ます。変更はすぐに保存されます。`}</p>
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}

      {linked && linked.length === 0 ? <p className="text-base">{t`まだ、ひもづけた場所はありません。`}</p> : null}
      <ul className="flex flex-col gap-1">
        {(linked ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-1.5">
            <span className="min-w-0 flex-1 text-base">
              <span className="font-bold">{p.nameJa}</span>
              <span className="ml-2 text-sm text-muted">{names[(placeCategories as readonly string[]).includes(p.category) ? (p.category as keyof typeof names) : "other"]}</span>
              {p.published ? null : <span className="ml-2 rounded-md border border-dashed border-line px-1.5 text-sm text-muted">{t`下書き`}</span>}
            </span>
            <button type="button" disabled={busy !== null} onClick={() => void link(p, null)} className={chip}>
              {t`はずす`}
            </button>
          </li>
        ))}
      </ul>

      <details className="rounded-lg border border-line px-3 py-2">
        <summary className="cursor-pointer text-base font-bold">{t`場所一覧から追加する`}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={t`種類`} value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 min-h-0 rounded-lg border border-line bg-paper px-2 text-sm font-bold">
              <option value="">{t`すべて`}</option>
              {placeCategories.map((c) => (
                <option key={c} value={c}>
                  {names[c]}
                </option>
              ))}
            </select>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t`名前で絞る`} aria-label={t`名前で絞る`} className="h-9 min-h-0 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm" />
          </div>
          <p className="text-sm text-muted">{from ? t`ルートの最初の経由地に近い順です。` : t`経由地を置くと、近い順に並びます。`}</p>
          {all && rows.length === 0 ? <p className="text-base">{t`該当する場所はありません。`}</p> : null}
          <ul className="flex max-h-80 flex-col gap-1 overflow-auto">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface">
                <span className="min-w-0 flex-1 text-base">
                  <span className="font-bold">{p.nameJa}</span>
                  <span className="ml-2 text-sm text-muted">{names[(placeCategories as readonly string[]).includes(p.category) ? (p.category as keyof typeof names) : "other"]}</span>
                  {distance(p.meters) ? <span className="ml-2 text-sm tabular-nums">{distance(p.meters)}</span> : null}
                  {p.routeId ? <span className="ml-2 text-sm text-muted">{t`別のルートにひもづいています`}</span> : null}
                </span>
                <button type="button" disabled={busy !== null} onClick={() => void link(p, routeId)} className={chip}>
                  {t`このルートに追加`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

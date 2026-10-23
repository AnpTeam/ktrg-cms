"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useCategoryNames } from "@/components/map/PlacesPanel";
import { pickList, type DirectoryPlace } from "@/lib/admin/directory-pick";
import { distanceLabel, placeCategories, type Coord } from "@/lib/places";

const chip = "inline-flex h-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-line bg-paper px-3 text-sm font-bold hover:bg-surface disabled:opacity-40";

/**
 * Puts a place from the site's places directory (parking, toilets, stations ...) on the route as a waypoint. The list is the
 * published places with a checked position, nearest first from the chosen waypoint (or the first one), so the parking by the
 * start is the first thing offered. Nothing is saved here: `onAdd` makes the waypoint and the editor saves it with the route.
 */
export function DirectoryPicker({ from, onAdd }: { from: Coord | null; onAdd: (place: DirectoryPlace) => void }) {
  const { t } = useLingui();
  const names = useCategoryNames();
  const [places, setPlaces] = useState<DirectoryPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState("parking");
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function load() {
    if (places) return;
    try {
      const res = await fetch("/api/v1/places", { credentials: "same-origin" });
      const json = (await res.json()) as { ok?: boolean; places?: DirectoryPlace[] };
      if (json.ok && Array.isArray(json.places)) setPlaces(json.places);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }

  const rows = places ? pickList(places, { from, category, query }) : [];
  return (
    <details onToggle={(e) => e.currentTarget.open && void load()} className="rounded-xl border border-line bg-paper px-4 py-2">
      <summary className="cursor-pointer text-base font-bold">{t`場所一覧から経由地を追加（駐車場・トイレ・駅など）`}</summary>
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
        <p className="text-sm text-muted">{from ? t`選んでいる経由地（なければ最初の経由地）に近い順です。` : t`経由地を置くと、近い順に並びます。`}</p>
        {failed ? <p role="alert" className="text-base font-bold text-danger">{t`場所一覧を読み込めませんでした。`}</p> : null}
        {places && rows.length === 0 ? <p className="text-base">{t`該当する場所はありません。`}</p> : null}
        <ul className="flex max-h-80 flex-col gap-1 overflow-auto">
          {rows.map((p) => {
            const d = p.meters === null ? null : distanceLabel(p.meters);
            const amount = d?.amount;
            const unit = d?.unit;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface">
                <span className="min-w-0 flex-1 text-base">
                  <span className="font-bold">{p.nameJa}</span>
                  <span className="ml-2 text-sm text-muted">{names[(placeCategories as readonly string[]).includes(p.category) ? (p.category as keyof typeof names) : "other"]}</span>
                  {d ? <span className="ml-2 text-sm tabular-nums">{t`${amount}${unit}`}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={added.has(p.id)}
                  onClick={() => {
                    onAdd(p);
                    setAdded(new Set(added).add(p.id));
                  }}
                  className={chip}
                >
                  {added.has(p.id) ? t`追加しました` : t`経由地に追加`}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

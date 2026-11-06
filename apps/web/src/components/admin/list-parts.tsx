"use client";

import { useLingui } from "@lingui/react/macro";
import type { Sort } from "@/lib/admin/lists/sort";
import { ArrowDownIcon, ArrowUpIcon, SortIcon } from "@/components/icons";

// The pieces every admin list screen is made of, so the generic lists and the route and rally lists look and work alike.

/** A column header that sorts when pressed; it says which way it is sorted (aria-sort and an arrow). */
export function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: string; sort: Sort; onSort: (key: string) => void }) {
  const on = sort?.key === sortKey ? sort.dir : null;
  return (
    <th scope="col" aria-sort={on === "asc" ? "ascending" : on === "desc" ? "descending" : "none"} className="p-0 font-bold">
      <button type="button" onClick={() => onSort(sortKey)} className="tap-target flex w-full items-center gap-1 px-3 text-left font-bold hover:bg-line/30">
        {label}
        <span aria-hidden="true" className={on ? "text-ink" : "text-muted"}>
          {on === "asc" ? <ArrowUpIcon size={18} /> : on === "desc" ? <ArrowDownIcon size={18} /> : <SortIcon size={18} />}
        </span>
      </button>
    </th>
  );
}

/** One filter as a row of buttons: "all" and each choice, the pressed one filled in. */
export function FilterGroup({ label, options, value, onChange, disabled }: { label: string; options: { value: string; text: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-base font-bold">{label}</span>
      {[{ value: "", text: t`すべて` }, ...options].map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(o.value)} className={`tap-target rounded-full border-2 px-4 text-base font-bold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"}`}>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

/** 前へ / 後ろへ for a list whose order matters (the walking order of routes, the order rallies are shown in). */
export function MoveButtons({ name, canEarlier, canLater, onMove, busy }: { name: string; canEarlier: boolean; canLater: boolean; onMove: (step: -1 | 1) => void; busy: boolean }) {
  const { t } = useLingui();
  return (
    <div className="flex gap-2">
      <button type="button" disabled={busy || !canEarlier} onClick={() => onMove(-1)} aria-label={t`${name} を1つ前へ`} className="tap-target min-w-14 rounded-full border-2 border-line px-3 text-base font-bold disabled:opacity-40">
        {t`前へ`}
      </button>
      <button type="button" disabled={busy || !canLater} onClick={() => onMove(1)} aria-label={t`${name} を1つ後ろへ`} className="tap-target min-w-14 rounded-full border-2 border-line px-3 text-base font-bold disabled:opacity-40">
        {t`後ろへ`}
      </button>
    </div>
  );
}

/** The round number of a row in an ordered list. */
export function OrderBadge({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand">
      {n}
    </span>
  );
}

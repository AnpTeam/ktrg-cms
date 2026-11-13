"use client";

import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Sort } from "@/lib/admin/lists/sort";
import { ArrowDownIcon, ArrowUpIcon, SortIcon } from "@/components/icons";

// The pieces every admin list screen is made of, so the generic lists and the route and rally lists look and work alike.

/** A column header that sorts when pressed; it says which way it is sorted (aria-sort and an arrow). */
export function SortHeader({ label, sortKey, sort, onSort, filter }: { label: string; sortKey: string; sort: Sort; onSort: (key: string) => void; filter?: ReactNode }) {
  const on = sort?.key === sortKey ? sort.dir : null;
  return (
    <th scope="col" aria-sort={on === "asc" ? "ascending" : on === "desc" ? "descending" : "none"} className="p-0 font-bold">
      <button type="button" onClick={() => onSort(sortKey)} className="tap-target flex w-full items-center gap-1 break-keep px-3 text-left [overflow-wrap:normal] font-bold hover:bg-line/30">
        {label}
        <span aria-hidden="true" className={on ? "text-ink" : "text-muted"}>
          {on === "asc" ? <ArrowUpIcon size={18} /> : on === "desc" ? <ArrowDownIcon size={18} /> : <SortIcon size={18} />}
        </span>
      </button>
      {filter ? <div className="px-3 pb-2">{filter}</div> : null}
    </th>
  );
}

/** A filter inside a column header. A native list: a table that scrolls sideways would cut off a menu of our own. */
export function HeaderFilter({ label, options, value, onChange }: { label: string; options: { value: string; text: string }[]; value: string; onChange: (value: string) => void }) {
  const { t } = useLingui();
  return (
    <select aria-label={t`${label}でしぼりこむ`} value={value} onChange={(e) => onChange(e.target.value)} className={`tap-target w-full min-w-24 rounded-full border-2 bg-paper px-2 text-base ${value ? "border-ink font-bold" : "border-line font-normal"}`}>
      <option value="">{t`すべて`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.text}
        </option>
      ))}
    </select>
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

/** Up and down arrows for a list whose order matters (the walking order of routes, the order rallies are shown in). */
export function MoveButtons({ name, canEarlier, canLater, onMove, busy, stacked }: { name: string; canEarlier: boolean; canLater: boolean; onMove: (step: -1 | 1) => void; busy: boolean; stacked?: boolean }) {
  const { t } = useLingui();
  const button = "tap-target flex size-12 items-center justify-center rounded-full border border-line disabled:opacity-40";
  const earlier = t`${name} を1つ前へ`;
  const later = t`${name} を1つ後ろへ`;
  return (
    <div className={`flex gap-2 ${stacked ? "flex-col" : ""}`}>
      <button type="button" disabled={busy || !canEarlier} onClick={() => onMove(-1)} aria-label={earlier} title={earlier} className={button}>
        <ArrowUpIcon size={22} />
      </button>
      <button type="button" disabled={busy || !canLater} onClick={() => onMove(1)} aria-label={later} title={later} className={button}>
        <ArrowDownIcon size={22} />
      </button>
    </div>
  );
}

/** The round number of a row in an ordered list. */
export function OrderBadge({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-strong text-lg font-bold text-on-brand-strong">
      {n}
    </span>
  );
}

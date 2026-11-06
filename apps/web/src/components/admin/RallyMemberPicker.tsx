"use client";

import { useLingui } from "@lingui/react/macro";
import { groupBy, tickAll, toggleMember } from "@/lib/admin/rally-edit";
import { moveId } from "@/lib/admin/route-list";
import type { AdminRallyCourse, AdminRallyKind, AdminRallyPlace } from "@/lib/admin/types";

type Candidates = { kind: "places"; items: AdminRallyPlace[] } | { kind: "course"; items: AdminRallyCourse[] };

// Every candidate of the rally's type with a tick box (stamp places grouped by course, or courses), then the ticked
// ones in their order, which the admin can change. The parent sends `selected` in one save.
export function RallyMemberPicker({
  candidates,
  selected,
  onChange,
  routeNames,
  locale,
  disabled,
}: {
  candidates: Candidates;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** route id -> its name, to head each group of places. */
  routeNames: Record<string, string>;
  locale: string;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const name = (x: { nameJa: string; nameEn: string | null }) => (locale === "en" && x.nameEn ? x.nameEn : x.nameJa);
  const idOf = (x: AdminRallyPlace | AdminRallyCourse) => ("spotId" in x ? x.spotId : x.routeId);
  const label = new Map<string, string>(candidates.items.map((x) => [idOf(x), name(x)]));
  const allIds = candidates.items.map(idOf);
  const box = "size-6 accent-[var(--color-brand)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => onChange(tickAll(selected, allIds, true))} className="tap-target rounded-full border-2 border-line px-4 text-base font-bold disabled:opacity-40">
          {t`すべて選ぶ`}
        </button>
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => onChange([])} className="tap-target rounded-full border-2 border-line px-4 text-base font-bold disabled:opacity-40">
          {t`すべて外す`}
        </button>
        <p className="tap-target flex items-center text-lg font-bold">{t`選んだ数：${selected.length} / ${allIds.length}`}</p>
      </div>

      {candidates.items.length === 0 ? (
        <p className="text-lg">{candidates.kind === "places" ? t`スタンプを押せる経由地がまだありません。ルートの画面で経由地を作ってください。` : t`ルートがまだありません。`}</p>
      ) : candidates.kind === "places" ? (
        <div className="flex flex-col gap-3">
          {groupBy(candidates.items, (p) => p.routeId).map((group) => {
            const ids = group.items.map((p) => p.spotId);
            const all = ids.every((id) => selected.includes(id));
            return (
              <fieldset key={group.key} className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-3">
                <legend className="px-1 text-base font-bold text-accent">{routeNames[group.key] ?? ""}</legend>
                <label className="tap-target flex items-center gap-3 text-base font-bold">
                  <input
                    type="checkbox"
                    className={box}
                    checked={all}
                    disabled={disabled}
                    onChange={() => onChange(all ? selected.filter((id) => !ids.includes(id)) : tickAll(selected, ids, true))}
                  />
                  {t`このルートの経由地をすべて`}
                </label>
                {group.items.map((p) => (
                  <label key={p.spotId} className="tap-target flex items-center gap-3 text-lg">
                    <input type="checkbox" className={box} checked={selected.includes(p.spotId)} disabled={disabled} onChange={() => onChange(toggleMember(selected, p.spotId))} />
                    <span>
                      {name(p)}
                      {p.published ? null : <span className="ml-2 text-base text-muted">{t`下書き`}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-3">
          {candidates.items.map((c) => (
            <label key={c.routeId} className="tap-target flex items-center gap-3 text-lg">
              <input type="checkbox" className={box} checked={selected.includes(c.routeId)} disabled={disabled} onChange={() => onChange(toggleMember(selected, c.routeId))} />
              <span>
                {name(c)}
                <span className="ml-2 text-base text-muted">
                  {c.publishedStampPlaceCount === 0 ? t`公開中のスタンプの経由地なし（達成できません）` : t`スタンプの経由地 ${c.publishedStampPlaceCount}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {selected.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">{t`ラリーの中の順番`}</h3>
          <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-paper">
            {selected.map((id, i) => {
              const text = label.get(id) ?? id;
              return (
                <li key={id} className="flex flex-wrap items-center gap-3 p-2 sm:flex-nowrap">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-on-brand">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-lg">{text}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={disabled || i === 0} onClick={() => onChange(moveId(selected, id, -1))} aria-label={t`${text} を1つ前へ`} className="tap-target min-w-14 rounded-full border-2 border-line px-3 text-base font-bold disabled:opacity-40">
                      {t`前へ`}
                    </button>
                    <button type="button" disabled={disabled || i === selected.length - 1} onClick={() => onChange(moveId(selected, id, 1))} aria-label={t`${text} を1つ後ろへ`} className="tap-target min-w-14 rounded-full border-2 border-line px-3 text-base font-bold disabled:opacity-40">
                      {t`後ろへ`}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export type { Candidates as RallyCandidates, AdminRallyKind };

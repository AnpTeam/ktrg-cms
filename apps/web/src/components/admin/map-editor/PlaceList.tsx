"use client";

import { useLingui } from "@lingui/react/macro";
import { pointKinds, type PointKind } from "@/lib/point-kinds";
import { useKindLabels } from "../PlacePanel";
import { TrashIcon } from "./icons";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import type { MapEditorProps } from "./MapEditor";

const fieldClass = "h-11 min-h-0 min-w-36 rounded-lg border border-line bg-paper px-2 text-base";
const chipToggle = (on: boolean) =>
  `inline-flex h-11 min-h-0 min-w-0 items-center justify-center rounded-full border px-3 text-sm font-bold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:bg-surface"}`;

/** Every waypoint of the route in one list: its name, its kind and its two switches can all be changed here. */
export function PlaceList({ places, selectedKey, onSelectPlace, onRemovePlace, onPatchPlace, onAddEndAt, onReorderPlaces, insertAfter, onInsertAfter, onDrawSubCourse }: Pick<MapEditorProps, "places" | "selectedKey" | "onSelectPlace" | "onRemovePlace" | "onPatchPlace" | "onAddEndAt" | "onReorderPlaces"> & { insertAfter: string | null; onInsertAfter: (key: string) => void; onDrawSubCourse: (key: string) => void }) {
  const { t } = useLingui();
  const kindName = useKindLabels();
  const stamps = places.filter((p) => p.stampable).length;
  const others = places.length - stamps;
  // The first stop of the path: a round trip ends where it began, so this is where an end point can be added.
  const firstStop = places.find((p) => !p.stopBy && p.lat !== null)?.key;
  const move = (i: number, step: -1 | 1) => {
    const keys = places.map((p) => p.key);
    const j = i + step;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    onReorderPlaces(keys);
  };
  // The sub-course of a side trip starts at the last waypoint before it that is on the route; choosing another puts it right after that one.
  const mainBefore = (i: number) => places.slice(0, i).findLast((p) => !p.stopBy && p.lat !== null)?.key ?? "";
  const branchTo = (key: string, from: string) => {
    const keys = places.map((p) => p.key).filter((k) => k !== key);
    keys.splice(keys.indexOf(from) + 1, 0, key);
    onReorderPlaces(keys);
  };
  const mains = places.filter((p) => !p.stopBy && p.lat !== null);
  return (
    <section aria-label={t`経由地の一覧`} className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-24">
      <h3 className="text-lg font-bold">
        {t`経由地（${places.length}か所）`}
        <span className="ml-3 text-sm font-normal text-muted">{t`スタンプ ${stamps}・そのほか ${others}`}</span>
      </h3>
      <ol className="flex max-h-[70dvh] flex-col gap-2 overflow-auto pr-1 xl:max-h-[calc(100dvh-12rem)]">
        {places.map((p, i) => (
          <li
            key={p.key}
            onClick={() => onSelectPlace(p.key)}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border bg-paper p-3 ${p.key === selectedKey ? "border-ink ring-2 ring-ink" : "border-line"}`}
          >
            {p.stopBy && mains.length > 0 ? (
              <div className="col-span-3 flex flex-col gap-2 rounded-lg bg-surface p-2" onClick={(e) => e.stopPropagation()}>
                <label className="flex min-w-0 flex-col gap-1 text-sm font-bold">
                  {t`サブコースの分岐点（ここから、この寄り道へ）`}
                  <select value={mainBefore(i)} onChange={(e) => branchTo(p.key, e.target.value)} className={`${fieldClass} w-full min-w-0`}>
                    <option value="" disabled>
                      {t`選ぶ`}
                    </option>
                    {mains.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name || t`（名前がありません）`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => onDrawSubCourse(p.key)} className={`${chipToggle(false)} self-start`} title={t`この寄り道の点を選んで、分岐点からここまでの線を描きます。本線はそのまま続きます。`}>
                  {t`サブコースの線を描く`}
                </button>
              </div>
            ) : null}
            <span
              aria-hidden="true"
              className={`flex shrink-0 items-center justify-center rounded-full text-base font-bold ${p.stampable ? "size-9 bg-brand-strong text-on-brand-strong" : "size-7 border-2 border-ink bg-paper"} ${p.stopBy ? "border-dashed" : ""}`}
            >
              {p.stampable ? p.number : ""}
            </span>
            <input
              value={p.name}
              onChange={(e) => onPatchPlace(p.key, { nameJa: e.target.value })}
              onFocus={() => onSelectPlace(p.key)}
              aria-label={t`名前`}
              placeholder={t`（名前がありません）`}
              maxLength={200}
              className={`${fieldClass} w-full text-lg font-bold`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePlace(p.key);
              }}
              aria-label={t`${p.name || p.number}を消す`}
              aria-disabled={p.published}
              title={p.published ? t`公開中の経由地は削除できません。先に「経由地」タブで「公開をやめる」を押してください。` : t`消す`}
              className={`inline-flex size-11 min-h-0 min-w-0 items-center justify-center rounded-full border border-line ${p.published ? "cursor-not-allowed text-muted opacity-60" : "text-danger hover:bg-surface"}`}
            >
              <TrashIcon />
            </button>
            <div className="col-start-2 col-end-4 flex flex-wrap items-center gap-2">
              <select value={p.kind} onChange={(e) => onPatchPlace(p.key, { kind: e.target.value as PointKind })} aria-label={t`種類`} className={fieldClass}>
                {pointKinds.map((k) => (
                  <option key={k} value={k}>
                    {kindName[k]}
                  </option>
                ))}
              </select>
              <button type="button" aria-pressed={p.stampable} onClick={() => onPatchPlace(p.key, { stampable: !p.stampable })} className={chipToggle(p.stampable)}>
                {t`スタンプ`}
              </button>
              <button type="button" aria-pressed={p.stopBy} onClick={() => onPatchPlace(p.key, { stopBy: !p.stopBy })} className={chipToggle(p.stopBy)}>
                {t`寄り道`}
              </button>
              {p.published ? (
                <span title={t`公開中の経由地は削除できません。編集すると下書きに戻ります。`} className="rounded-full bg-moss px-2.5 py-0.5 text-sm font-bold text-paper">
                  {t`公開中`}
                </span>
              ) : null}
              {p.key === firstStop && places.length >= 2 ? (
                <button type="button" onClick={() => onAddEndAt(p.key)} className={chipToggle(false)} title={t`一周して、ここに戻るルートのとき: 同じ位置に、スタンプのない終点を追加します`}>
                  {t`同じ場所に終点を追加`}
                </button>
              ) : null}
              {p.lat === null ? <span className="text-sm font-bold text-danger">{t`位置なし`}</span> : null}
            </div>
            <div className="col-start-2 col-end-4 flex flex-wrap items-center gap-2">
              <button type="button" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} aria-label={t`${p.name || p.number}を前へ`} title={t`順番を前へ`} className={chipToggle(false)}>
                <ArrowUpIcon size={22} />
              </button>
              <button type="button" disabled={i === places.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} aria-label={t`${p.name || p.number}を後ろへ`} title={t`順番を後ろへ`} className={chipToggle(false)}>
                <ArrowDownIcon size={22} />
              </button>
              <button type="button" aria-pressed={insertAfter === p.key} onClick={(e) => { e.stopPropagation(); onInsertAfter(p.key); }} className={chipToggle(insertAfter === p.key)} title={t`地図をクリックして、この経由地のすぐ次に新しい経由地を入れます`}>
                {t`この次に追加`}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

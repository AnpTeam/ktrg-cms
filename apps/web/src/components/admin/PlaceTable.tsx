"use client";

import { useLingui } from "@lingui/react/macro";
import { pointKinds, type PointKind } from "@/lib/point-kinds";
import type { PlaceDraft } from "@/lib/admin/route-draft";
import { inputClass, NumberInput } from "./fields";
import { useKindLabels } from "./PlacePanel";

// The places of a route as one table, to type many in one go (a new route, or a list copied from a sheet): name,
// kind, latitude and longitude per row. It edits the same draft as the map and the detailed panels, and the
// editor's 保存する saves the route and every row together. A typed position is not checked yet (位置を確認した is
// ticked per place afterwards, against an official source), so it stays hidden from visitors until then.
export function PlaceTable({
  places,
  busy,
  invalidName,
  onChange,
  onRemove,
  onAdd,
}: {
  places: PlaceDraft[];
  busy: boolean;
  invalidName: (key: string) => boolean;
  onChange: (key: string, patch: Partial<PlaceDraft>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const { t } = useLingui();
  const kindName = useKindLabels();

  return (
    <div className="flex flex-col gap-3">
      {places.length > 0 ? (
        // The table may be wider than a phone: it scrolls on its own, the page does not.
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead className="bg-paper text-base">
              <tr>
                <th scope="col" className="w-12 p-2 font-bold">
                  #
                </th>
                <th scope="col" className="p-2 font-bold">
                  {t`名前（日本語）`}
                </th>
                <th scope="col" className="w-44 p-2 font-bold">
                  {t`種類`}
                </th>
                <th scope="col" className="w-40 p-2 font-bold">
                  {t`緯度`}
                </th>
                <th scope="col" className="w-40 p-2 font-bold">
                  {t`経度`}
                </th>
                <th scope="col" className="w-24 p-2">
                  <span className="sr-only">{t`削除`}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {places.map((p, i) => {
                const row = i + 1;
                return (
                  <tr key={p.key}>
                    <td className="p-2 text-lg font-bold">{row}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        lang="ja"
                        value={p.nameJa}
                        maxLength={200}
                        aria-label={t`${row}行目の名前`}
                        aria-invalid={invalidName(p.key) || undefined}
                        disabled={busy}
                        onChange={(e) => onChange(p.key, { nameJa: e.target.value })}
                        className={`${inputClass} ${invalidName(p.key) ? "border-danger" : ""}`}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={p.kind}
                        aria-label={t`${row}行目の種類`}
                        disabled={busy}
                        onChange={(e) => onChange(p.key, { kind: e.target.value as PointKind })}
                        className={inputClass}
                      >
                        {pointKinds.map((k) => (
                          <option key={k} value={k}>
                            {kindName[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <NumberInput id={`${p.key}-lat`} value={p.lat} min={-90} max={90} onChange={(v) => onChange(p.key, { lat: v })} ariaLabel={t`${row}行目の緯度`} />
                    </td>
                    <td className="p-2">
                      <NumberInput id={`${p.key}-lng`} value={p.lng} min={-180} max={180} onChange={(v) => onChange(p.key, { lng: v })} ariaLabel={t`${row}行目の経度`} />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemove(p.key)}
                        aria-label={t`${row}行目を削除`}
                        className="tap-target rounded-xl border-2 border-line px-3 text-base font-bold disabled:opacity-50"
                      >
                        {t`削除`}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-paper p-4 text-lg">{t`まだありません。「＋ 行を追加」で、場所を表に入れてください。`}</p>
      )}
      <button type="button" disabled={busy} onClick={onAdd} className="tap-target w-fit rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-50">
        {t`＋ 行を追加`}
      </button>
      <p className="text-base text-muted">{t`緯度・経度は、公式の情報で確かめてから、場所ごとに「位置を確認した」にチェックを入れてください。それまで訪れる人には表示されません。`}</p>
    </div>
  );
}

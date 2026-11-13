"use client";

import { useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { pointKinds, stampableByDefault, type PointKind } from "@/lib/point-kinds";
import type { PlaceDraft } from "@/lib/admin/route-draft";
import { inputClass, NumberInput } from "./fields";
import { useKindLabels } from "./PlacePanel";
import { PlusIcon } from "@/components/icons";

/** Column widths in px: #, name, kind, stamp, latitude, longitude, delete. Drag the edge of a heading to change one. */
const DEFAULT_WIDTHS = [48, 260, 200, 110, 150, 150, 100];
const MIN_WIDTH = 48;
const MAX_WIDTH = 640;
const STORAGE_KEY = "place-table-widths";

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

/** What this device saved last time, as text (a convenience only: any problem means the defaults). */
function savedWidths(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseWidths(raw: string | null): number[] {
  try {
    const list: unknown = JSON.parse(raw ?? "null");
    if (Array.isArray(list) && list.length === DEFAULT_WIDTHS.length && list.every((n) => typeof n === "number")) return list.map(clampWidth);
  } catch {
    // not ours
  }
  return DEFAULT_WIDTHS;
}

const onStorage = (notify: () => void) => {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};

// The waypoints of a route as one table, to type many in one go (a new route, or a list copied from a sheet): name,
// kind, stamp switch, latitude and longitude per row. It edits the same draft as the map and the detailed panels, and the
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
  // The saved widths are known only in the browser: the server's first render uses the defaults, then the saved ones take over.
  const saved = useSyncExternalStore(onStorage, savedWidths, () => null);
  const [dragged, setDragged] = useState<number[] | null>(null);
  const widths = dragged ?? parseWidths(saved);

  const setWidth = (i: number, w: number, save: boolean) => {
    const next = widths.map((x, j) => (j === i ? clampWidth(w) : x));
    setDragged(next);
    if (!save) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // not kept this time
    }
  };

  /** A heading with a grip on its right edge: drag it (mouse, finger or pen), or focus it and press the arrow keys; double-click resets. */
  const heading = (i: number, label: ReactNode, srOnly = false) => (
    <th scope="col" className="relative p-2 font-bold">
      {srOnly ? <span className="sr-only">{label}</span> : label}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={t`列の幅を変える`}
        aria-valuenow={widths[i]}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        title={t`ドラッグで列の幅を変えます（ダブルクリックで元に戻します）`}
        className="absolute right-0 top-0 flex h-full w-3 cursor-col-resize touch-none select-none justify-center focus-visible:outline-2 focus-visible:outline-accent [&>span]:w-px [&>span]:bg-line hover:[&>span]:w-0.5 hover:[&>span]:bg-ink"
        onPointerDown={(e: PointerEvent<HTMLSpanElement>) => {
          e.preventDefault();
          const grip = e.currentTarget;
          grip.setPointerCapture(e.pointerId);
          const [x0, w0] = [e.clientX, widths[i]!];
          const move = (m: globalThis.PointerEvent) => setWidth(i, w0 + m.clientX - x0, false);
          const up = (m: globalThis.PointerEvent) => {
            setWidth(i, w0 + m.clientX - x0, true);
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", up);
          };
          grip.addEventListener("pointermove", move);
          grip.addEventListener("pointerup", up);
        }}
        onDoubleClick={() => setWidth(i, DEFAULT_WIDTHS[i]!, true)}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          const step = e.shiftKey ? 48 : 16;
          if (e.key === "ArrowRight") setWidth(i, widths[i]! + step, true);
          else if (e.key === "ArrowLeft") setWidth(i, widths[i]! - step, true);
          else return;
          e.preventDefault();
        }}
      >
        <span aria-hidden="true" />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {places.length > 0 ? (
        // The table may be wider than a phone: it scrolls on its own, the page does not (relative: its visually hidden inputs are clipped with it).
        <div className="relative overflow-x-auto rounded-2xl border border-line">
          <table style={{ width: widths.reduce((a, b) => a + b, 0), tableLayout: "fixed" }} className="border-collapse text-left">
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead className="bg-paper text-base">
              <tr>
                {heading(0, "#")}
                {heading(1, t`名前（日本語）`)}
                {heading(2, t`種類`)}
                {heading(3, t`スタンプ`)}
                {heading(4, t`緯度`)}
                {heading(5, t`経度`)}
                {heading(6, t`削除`, true)}
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
                        // A new waypoint's stamp switch follows its kind, as in the detail panel; a saved one keeps its own.
                        onChange={(e) => {
                          const kind = e.target.value as PointKind;
                          onChange(p.key, p.id === null ? { kind, stampable: stampableByDefault(kind) } : { kind });
                        }}
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
                      <input
                        type="checkbox"
                        checked={p.stampable}
                        disabled={busy}
                        aria-label={t`${row}行目：スタンプを押せる`}
                        onChange={(e) => onChange(p.key, { stampable: e.target.checked })}
                        className="size-6 accent-[var(--color-brand)]"
                      />
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
                        className="tap-target rounded-full border border-line px-3 text-base font-bold disabled:opacity-50"
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
        <p className="rounded-xl bg-paper p-4 text-lg">{t`まだありません。「＋ 行を追加」で、経由地を表に入れてください。`}</p>
      )}
      <button type="button" disabled={busy} onClick={onAdd} className="tap-target w-fit rounded-full border border-line px-5 text-lg font-bold disabled:opacity-50">
        <span className="inline-flex items-center gap-1">
              <PlusIcon size={20} />
              {t`行を追加`}
            </span>
      </button>
      <p className="text-base text-muted">{t`緯度・経度は、公式の情報で確かめてから、場所ごとに「位置を確認した」にチェックを入れてください。それまで訪れる人には表示されません。`}</p>
    </div>
  );
}

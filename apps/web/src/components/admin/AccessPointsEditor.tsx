"use client";

import { useLingui } from "@lingui/react/macro";
import { useAccessTypeNames, AccessIcon } from "@/components/AccessList";
import { accessTypes, isAccessType, MAX_ACCESS_POINTS, newAccessPoint, type AccessPoint } from "@/lib/access-points";
import { Field, inputClass, TextInput } from "./fields";

/**
 * How to get there, as rows: pick the kind (train, bus, ferry ...), then the place and a short note in Japanese and
 * English. The public page shows each row like a Start / Goal badge. Rows can be moved and removed; a row with no
 * Japanese name is dropped when the route is saved.
 */
export function AccessPointsEditor({ value, onChange }: { value: AccessPoint[]; onChange: (next: AccessPoint[]) => void }) {
  const { t } = useLingui();
  const names = useAccessTypeNames();
  const set = (i: number, patch: Partial<AccessPoint>) => onChange(value.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const move = (i: number, by: number) => {
    const next = [...value];
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row!);
    onChange(next);
  };
  const nullIfEmpty = (v: string) => (v === "" ? null : v);

  return (
    <div className="flex flex-col gap-4">
      {value.map((p, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
          <div className="flex flex-wrap items-center gap-3">
            <AccessIcon type={p.type} size={36} />
            <select
              aria-label={t`交通の種類`}
              value={p.type}
              onChange={(e) => isAccessType(e.target.value) && set(i, { type: e.target.value })}
              className={`${inputClass} max-w-48`}
            >
              {accessTypes.map((type) => (
                <option key={type} value={type}>
                  {names[type]}
                </option>
              ))}
            </select>
            <span className="ml-auto flex gap-2">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t`上へ`} className="tap-target rounded-xl border-2 border-line px-4 text-lg font-bold disabled:opacity-40">
                ↑
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={t`下へ`} className="tap-target rounded-xl border-2 border-line px-4 text-lg font-bold disabled:opacity-40">
                ↓
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="tap-target rounded-xl border-2 border-line px-4 text-lg font-bold">
                {t`削除`}
              </button>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t`場所の名前（日本語）`} htmlFor={`access-${i}-name-ja`}>
              <TextInput id={`access-${i}-name-ja`} lang="ja" value={p.nameJa} onChange={(v) => set(i, { nameJa: v })} maxLength={100} />
            </Field>
            <Field label={t`場所の名前（English）`} htmlFor={`access-${i}-name-en`}>
              <TextInput id={`access-${i}-name-en`} lang="en" value={p.nameEn ?? ""} onChange={(v) => set(i, { nameEn: nullIfEmpty(v) })} maxLength={100} />
            </Field>
            <Field label={t`ひとこと（日本語）`} htmlFor={`access-${i}-note-ja`}>
              <TextInput id={`access-${i}-note-ja`} lang="ja" value={p.noteJa ?? ""} onChange={(v) => set(i, { noteJa: nullIfEmpty(v) })} maxLength={300} />
            </Field>
            <Field label={t`ひとこと（English）`} htmlFor={`access-${i}-note-en`}>
              <TextInput id={`access-${i}-note-en`} lang="en" value={p.noteEn ?? ""} onChange={(v) => set(i, { noteEn: nullIfEmpty(v) })} maxLength={300} />
            </Field>
          </div>
          <Field label={t`リンク（任意）`} htmlFor={`access-${i}-url`} hint={t`https:// から始まるアドレス。入れると、場所の名前がリンクになります。`}>
            <TextInput id={`access-${i}-url`} value={p.url ?? ""} onChange={(v) => set(i, { url: nullIfEmpty(v.trim()) })} maxLength={500} placeholder="https://" invalid={!!p.url && !/^https:\/\//.test(p.url)} />
          </Field>
        </div>
      ))}
      <button
        type="button"
        disabled={value.length >= MAX_ACCESS_POINTS}
        onClick={() => onChange([...value, newAccessPoint(value.length === 0 ? "train" : "bus")])}
        className="tap-target w-fit rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-40"
      >
        {t`＋ 交通を追加`}
      </button>
    </div>
  );
}

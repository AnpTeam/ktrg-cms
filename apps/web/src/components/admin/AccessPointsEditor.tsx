"use client";

import { useLingui } from "@lingui/react/macro";
import { useAccessTypeNames, AccessIcon } from "@/components/AccessList";
import { accessServes, accessTypes, gsiMapUrl, isAccessType, MAX_ACCESS_POINTS, newAccessPoint, type AccessPoint } from "@/lib/access-points";
import { Check, Field, inputClass, NumberInput, TextInput } from "./fields";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "@/components/icons";

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
  const serveNames = { start: t`スタート側`, end: t`ゴール側`, both: t`どちらでも` };

  return (
    <div className="flex flex-col gap-4">
      {value.map((p, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
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
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t`上へ`} className="tap-target rounded-full border border-line px-4 text-lg font-bold disabled:opacity-40">
                <ArrowUpIcon size={22} />
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={t`下へ`} className="tap-target rounded-full border border-line px-4 text-lg font-bold disabled:opacity-40">
                <ArrowDownIcon size={22} />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="tap-target rounded-full border border-line px-4 text-lg font-bold">
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t`緯度`} htmlFor={`access-${i}-lat`}>
              <NumberInput id={`access-${i}-lat`} value={p.lat ?? null} min={-90} max={90} step={0.00001} onChange={(v) => set(i, { lat: v, ...(v === null ? { checked: false } : {}) })} />
            </Field>
            <Field label={t`経度`} htmlFor={`access-${i}-lng`}>
              <NumberInput id={`access-${i}-lng`} value={p.lng ?? null} min={-180} max={180} step={0.00001} onChange={(v) => set(i, { lng: v, ...(v === null ? { checked: false } : {}) })} />
            </Field>
            <Field label={t`どちら側の入口か`} htmlFor={`access-${i}-serves`}>
              <select id={`access-${i}-serves`} value={p.serves ?? ""} onChange={(e) => set(i, { serves: accessServes.find((s) => s === e.target.value) ?? null })} className={inputClass}>
                <option value="">{t`指定しない`}</option>
                {accessServes.map((s) => (
                  <option key={s} value={s}>
                    {serveNames[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {p.lat != null && p.lng != null ? (
            <div className="flex flex-col gap-3">
              <Field label={t`位置の出どころ`} htmlFor={`access-${i}-source`} hint={t`駅や会社の公式ページなど、位置を調べた場所の名前。`}>
                <TextInput id={`access-${i}-source`} lang="ja" value={p.source ?? ""} onChange={(v) => set(i, { source: nullIfEmpty(v), ...(v.trim() === "" ? { checked: false } : {}) })} maxLength={300} />
              </Field>
              <a href={gsiMapUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="tap-target flex w-fit items-center text-lg font-bold text-accent underline">
                {t`地図で位置を見る（新しいタブ）`}
              </a>
              <Check id={`access-${i}-checked`} checked={p.checked === true} disabled={!p.source?.trim()} onChange={(v) => set(i, { checked: v })}>
                {t`位置を確認した（確認するまで、利用者には位置を出しません）`}
              </Check>
            </div>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        disabled={value.length >= MAX_ACCESS_POINTS}
        onClick={() => onChange([...value, newAccessPoint(value.length === 0 ? "train" : "bus")])}
        className="tap-target w-fit rounded-full border border-line px-5 text-lg font-bold disabled:opacity-40"
      >
        <span className="inline-flex items-center gap-1">
              <PlusIcon size={20} />
              {t`交通を追加`}
            </span>
      </button>
    </div>
  );
}

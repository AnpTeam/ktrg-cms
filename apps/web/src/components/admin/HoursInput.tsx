"use client";

import { useLingui } from "@lingui/react/macro";
import { addPeriod, copyDay, hasBackward, hoursText, isBackward, MAX_PERIODS, parseHours, removePeriod, setClosed, setTime } from "@/lib/admin/opening-hours";
import { inputClass, TextInput } from "./fields";
import { PlusIcon } from "@/components/icons";

const button = "tap-target rounded-full border border-line px-4 text-base font-bold disabled:opacity-40";

/** Weekly opening hours: one row per day, a time picker for each period, a second period for a shop open twice in a day. */
export function HoursInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  const h = parseHours(value);
  const set = (next: typeof h) => onChange(hoursText(next));
  const names = [t`月曜日`, t`火曜日`, t`水曜日`, t`木曜日`, t`金曜日`, t`土曜日`, t`日曜日`];
  return (
    <div className="flex flex-col gap-3">
      {names.map((name, day) => {
        const periods = h.days[day]!;
        const closed = periods.length === 0;
        return (
          <div key={name} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="w-24 text-lg font-bold">{name}</p>
              <label htmlFor={`${id}-closed-${day}`} className="tap-target flex items-center gap-3 text-lg">
                <input id={`${id}-closed-${day}`} type="checkbox" checked={closed} disabled={disabled} onChange={(e) => set(setClosed(h, day, e.target.checked))} className="size-6 accent-[var(--color-brand)]" />
                <span>{t`休み`}</span>
              </label>
            </div>
            {periods.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input type="time" aria-label={t`${name} ${i + 1}つ目の開く時間`} value={p.open} disabled={disabled} onChange={(e) => set(setTime(h, day, i, "open", e.target.value))} aria-invalid={isBackward(p) || undefined} className={`${inputClass} max-w-40`} />
                <span className="text-lg">〜</span>
                <input type="time" aria-label={t`${name} ${i + 1}つ目の閉まる時間`} value={p.close} disabled={disabled} onChange={(e) => set(setTime(h, day, i, "close", e.target.value))} aria-invalid={isBackward(p) || undefined} className={`${inputClass} max-w-40`} />
                <button type="button" disabled={disabled} onClick={() => set(removePeriod(h, day, i))} className={button}>
                  {t`削除`}
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {closed ? null : (
                <button type="button" disabled={disabled || periods.length >= MAX_PERIODS} onClick={() => set(addPeriod(h, day))} className={button}>
                  <span className="inline-flex items-center gap-1">
              <PlusIcon size={20} />
              {t`時間を追加（昼休みなど）`}
            </span>
                </button>
              )}
              {day === 0 && !closed ? (
                <button type="button" disabled={disabled} onClick={() => set(copyDay(h, 0, [1, 2, 3, 4]))} className={button}>
                  {t`火〜金に同じ時間を入れる`}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {hasBackward(h) ? (
        <p role="alert" className="text-base font-bold text-danger">
          {t`閉まる時間が開く時間より前になっている行があります。日をまたぐ営業は、その日の分と次の日の分に分けて入れてください。`}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note-ja`} className="text-base font-bold">
          {t`補足（日本語）`}
        </label>
        <TextInput id={`${id}-note-ja`} value={h.noteJa} onChange={(v) => set({ ...h, noteJa: v })} maxLength={300} lang="ja" placeholder={t`例：祝日は休み／ラストオーダーは閉店30分前`} />
        <label htmlFor={`${id}-note-en`} className="mt-2 text-base font-bold">
          {t`補足（English）`}
        </label>
        <TextInput id={`${id}-note-en`} value={h.noteEn} onChange={(v) => set({ ...h, noteEn: v })} maxLength={300} lang="en" />
      </div>
    </div>
  );
}

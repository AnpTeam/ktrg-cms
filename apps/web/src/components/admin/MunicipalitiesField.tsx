"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/icons";
import { buttonStyle } from "@/components/button";
import { englishCityName, municipalities, splitCities, towns, type MunicipalityPrefecture } from "@/lib/municipalities";
import { Field, inputClass, TextInput } from "./fields";

/** The API accepts this many (api/src/content/admin-routes.ts). */
const MAX_CITIES = 8;
const PREFECTURES: readonly MunicipalityPrefecture[] = ["wakayama", "osaka", "nara"];

/**
 * The cities a course runs through, in walking order. A course can cross from one city into another, even from one
 * prefecture into the next (和歌山市 → 岬町), so cities are added one by one from the list of all three prefectures, then
 * moved up or down or taken off. A name that is in no list is typed in. The course's prefecture is not asked for: it
 * follows the first listed city (route-draft). The Japanese name is what is saved; the English page shows the English name
 * of a listed city, town or village.
 */
export function MunicipalitiesField({
  id,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Shown red after a save was refused because no city or town is chosen. */
  invalid?: boolean;
}) {
  const { t } = useLingui();
  const [typed, setTyped] = useState("");
  const cityWord = t`市`;
  const townWord = t`町・村`;
  const full = value.length >= MAX_CITIES;
  const prefName: Record<MunicipalityPrefecture, string> = { wakayama: t`和歌山県`, osaka: t`大阪府`, nara: t`奈良県` };

  const add = (cities: readonly string[]) => {
    const next = [...value];
    for (const city of cities) if (next.length < MAX_CITIES && city !== next[next.length - 1]) next.push(city);
    onChange(next);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...value];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const addTyped = () => {
    add(splitCities(typed));
    setTyped("");
  };
  // Icon buttons, like the access points' rows: the name, then up and down, a divider, and the trash bin.
  const iconButton = "tap-target inline-flex items-center justify-center rounded-full border-2 border-line px-3 text-ink disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t`市区町村`}
        required
        status={value.length === 0 ? t`未選択` : undefined}
        htmlFor={id}
        hint={t`通る順に並べます。市・町・村は一覧から選びます。一覧にない地名は、下に入力して追加します（8つまで）。`}
      >
        <ol className="flex flex-col gap-2">
          {value.map((city, i) => {
            const en = englishCityName(city);
            return (
              <li key={`${i}-${city}`} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-line bg-paper px-3 py-2">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-base font-bold text-paper">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-lg font-bold">
                  {city}
                  {en ? <span className="ml-2 text-base font-normal text-muted">（{en}）</span> : null}
                </span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t`${city}を上へ`} className={iconButton}>
                  <ArrowUpIcon size={22} />
                </button>
                <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={t`${city}を下へ`} className={iconButton}>
                  <ArrowDownIcon size={22} />
                </button>
                <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
                <button type="button" onClick={() => remove(i)} aria-label={t`${city}を削除`} className={iconButton}>
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ol>
        <select
          id={id}
          value=""
          disabled={full}
          onChange={(e) => {
            if (e.target.value) add([e.target.value]);
          }}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${invalid ? "border-danger" : ""}`}
        >
          <option value="">{t`市や町を選んで追加`}</option>
          {PREFECTURES.flatMap((p) => [
            { key: `${p}-city`, label: `${prefName[p]} ${cityWord}`, list: municipalities[p] },
            { key: `${p}-town`, label: `${prefName[p]} ${townWord}`, list: towns[p] },
          ]).map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.list.map((c) => (
                <option key={c.ja} value={c.ja}>
                  {c.ja}（{c.en}）
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t`一覧にない地名`} htmlFor={`${id}-typed`}>
            <TextInput id={`${id}-typed`} value={typed} onChange={setTyped} maxLength={100} />
          </Field>
        </div>
        <button type="button" disabled={full || splitCities(typed).length === 0} onClick={addTyped} className={buttonStyle("secondary", "md", "inline-flex")}>
          {t`追加`}
        </button>
      </div>
    </div>
  );
}

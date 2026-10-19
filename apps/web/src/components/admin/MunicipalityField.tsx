"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { isListedMunicipality, municipalitiesOf, type MunicipalityPrefecture } from "@/lib/municipalities";
import { Field, inputClass, TextInput } from "./fields";

const OTHER = "__other";

/**
 * The city of a course: a list of the cities of the chosen prefecture (the Japanese name is saved, and the English
 * page shows the English name), so nobody types a name two ways. A town or village that is not a city is entered by
 * choosing 「その他」 and typing it.
 */
export function MunicipalityField({
  id,
  prefecture,
  value,
  onChange,
}: {
  id: string;
  prefecture: MunicipalityPrefecture | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLingui();
  const [typing, setTyping] = useState(false);
  const cities = municipalitiesOf(prefecture);
  const listed = isListedMunicipality(prefecture, value);
  // A saved name that is not in the list (typed before, or from another prefecture) is shown in the box.
  const other = typing || (value.trim() !== "" && !listed);
  const selected = other ? OTHER : listed ? value : "";

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={t`市区町村`}
        htmlFor={id}
        hint={prefecture ? t`市の名前を選びます。町や村は「その他」を選んで入力します。` : t`先に、都道府県を選んでください。`}
      >
        <select
          id={id}
          value={selected}
          disabled={!prefecture}
          onChange={(e) => {
            const next = e.target.value;
            if (next === OTHER) {
              setTyping(true);
              if (listed) onChange(""); // the box starts empty when leaving a listed city
            } else {
              setTyping(false);
              onChange(next);
            }
          }}
          className={`${inputClass} min-w-48`}
        >
          <option value="">{t`未選択`}</option>
          {cities.map((c) => (
            <option key={c.ja} value={c.ja}>
              {c.ja}（{c.en}）
            </option>
          ))}
          <option value={OTHER}>{t`その他（入力する）`}</option>
        </select>
      </Field>
      {other ? (
        <Field label={t`町や村の名前`} htmlFor={`${id}-other`} hint={t`英語のページには、入れた文字がそのまま表示されます。`}>
          <TextInput id={`${id}-other`} value={value} onChange={onChange} maxLength={100} />
        </Field>
      ) : null}
    </div>
  );
}

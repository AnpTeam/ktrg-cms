"use client";

import { useLingui } from "@lingui/react/macro";
import {
  ageRanges,
  foundVias,
  genders,
  type AgeRange,
  type FoundVia,
  type Gender,
} from "@/lib/auth-flow";

export function useAgeRangeNames(): Record<AgeRange, string> {
  const { t } = useLingui();
  return {
    under20: t`20歳未満`,
    "20s": t`20代`,
    "30s": t`30代`,
    "40s": t`40代`,
    "50s": t`50代`,
    "60s": t`60代`,
    "70s": t`70代`,
    "80s": t`80代`,
    "90plus": t`90歳以上`,
    "70plus": t`70歳以上`,
  };
}

export function useGenderNames(): Record<Gender, string> {
  const { t } = useLingui();
  return {
    female: t`女性`,
    male: t`男性`,
    other: t`その他`,
    unspecified: t`答えたくない`,
  };
}

const tile =
  "tap-target flex cursor-pointer items-center justify-center rounded-full border-2 px-2 py-3 text-center text-lg font-bold leading-tight focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-accent";

function Tiles<K extends string>({
  name,
  keys,
  names,
  value,
  onChange,
  columns,
}: {
  name: string;
  keys: readonly K[];
  names: Record<K, string>;
  value: K | null;
  onChange: (value: K | null) => void;
  columns: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {keys.map((key) => {
        const on = value === key;
        return (
          <label
            key={key}
            className={`${tile} ${on ? "border-selected bg-selected text-on-selected" : "border-line bg-paper text-ink"}`}
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={on}
              onChange={() => onChange(key)}
              onClick={() => on && onChange(null)}
              className="sr-only"
            />
            {names[key]}
          </label>
        );
      })}
    </div>
  );
}

/** "Your age": big tiles; tapping the chosen one again clears it (optional). */
export function AgeRangePicker({
  value,
  onChange,
}: {
  value: AgeRange | null;
  onChange: (value: AgeRange | null) => void;
}) {
  const { t } = useLingui();
  const names = useAgeRangeNames();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-bold">{t`年代`}</legend>
      <Tiles
        name="ageRange"
        keys={ageRanges}
        names={names}
        value={value}
        onChange={onChange}
        columns={3}
      />
    </fieldset>
  );
}

/**
 * "Your gender": "答えたくない" is a real choice, so nobody has to say. Tapping the chosen tile again
 * clears it (which means "not answered yet").
 */
export function GenderPicker({
  value,
  onChange,
}: {
  value: Gender | null;
  onChange: (value: Gender | null) => void;
}) {
  const { t } = useLingui();
  const names = useGenderNames();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-bold">{t`性別`}</legend>
      <Tiles
        name="gender"
        keys={genders}
        names={names}
        value={value}
        onChange={onChange}
        columns={2}
      />
    </fieldset>
  );
}

export function useFoundViaNames(): Record<FoundVia, string> {
  const { t } = useLingui();
  return {
    qr_or_sign: t`QRコード・看板`,
    tourism_site: t`観光サイト`,
    sns: t`SNS`,
    search: t`検索`,
    friend: t`友人・知人`,
    other: t`その他`,
  };
}

/** "How did you find out about this?": big tiles, optional; tapping the chosen one again clears it. */
export function FoundViaPicker({
  value,
  onChange,
}: {
  value: FoundVia | null;
  onChange: (value: FoundVia | null) => void;
}) {
  const { t } = useLingui();
  const names = useFoundViaNames();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-bold">{t`このアプリを知ったきっかけ`}</legend>
      <Tiles
        name="foundVia"
        keys={foundVias}
        names={names}
        value={value}
        onChange={onChange}
        columns={2}
      />
    </fieldset>
  );
}

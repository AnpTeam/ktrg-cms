"use client";

import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { type AuthFailure, type Origin } from "@/lib/auth-flow";
import { COUNTRY_REGIONS, countryOptions, originOfPlace, placeOfOrigin, PREFECTURE_REGIONS, regionName } from "@/lib/origin-places";
import { useErrorMessages } from "../useErrorMessages";
import { buttonStyle } from "@/components/button";

// Pieces shared by the login, register and profile screens. Big targets, few words, one action per step.

export const primaryButton =
  buttonStyle("action", "lg", "flex w-full");
export const secondaryButton =
  buttonStyle("secondary", "lg", "flex w-full");
export const inputClass =
  "tap-target w-full rounded-xl border-2 border-ink bg-paper px-4 text-xl text-ink placeholder:text-muted";

/**
 * A big tile to choose one way to go on: a round icon and a short title (and, only when it helps, a
 * line under it). The main choice is filled red; the other is an outlined tile. No "recommended"
 * wording: the filled tile is the quiet suggestion.
 */
export function ChoiceCard({
  icon,
  title,
  hint,
  primary = false,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  primary?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap-target flex min-h-[5rem] w-full items-center gap-4 rounded-full p-4 text-left disabled:opacity-60 ${
        primary ? "bg-ink text-paper" : "border border-ink bg-surface text-ink hover:bg-paper"
      }`}
    >
      <span
        className={`flex size-14 shrink-0 items-center justify-center rounded-full ${
          primary ? "bg-paper text-ink" : "bg-ink text-paper"
        } [&_svg]:size-7`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-snug">{title}</span>
        {hint ? <span className="mt-0.5 block text-lg">{hint}</span> : null}
      </span>
    </button>
  );
}

/** The visitor-facing sentence for each failure: the app-wide table (components/useErrorMessages.ts). */
export const useFailureMessages = useErrorMessages;

export function AuthError({ code }: { code: AuthFailure | null }) {
  const messages = useFailureMessages();
  if (!code) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-danger p-3 text-lg font-bold text-danger">
      {messages[code]}
    </p>
  );
}

export function useOriginNames(): Record<Origin, string> {
  const { t } = useLingui();
  return {
    osaka: t`大阪府`,
    wakayama: t`和歌山県`,
    nara: t`奈良県`,
    other_japan: t`日本`,
    overseas: t`海外`,
  };
}

/** An answer to "where do you come from": the plain one, and the prefecture or country when one was chosen. */
export type OriginAnswer = { origin: Origin | null; place: string | null };

const OTHER_JAPAN = "other_japan";

/**
 * "Where do you come from": two big boxes, then the list that goes with the box. Answering is optional, and 「選びなおす」
 * clears it. Native lists with sections: on a phone they open the system's own large picker.
 */
export function OriginPicker({ value, onChange }: { value: OriginAnswer; onChange: (value: OriginAnswer) => void }) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale;
  const place = value.place ?? placeOfOrigin(value.origin);
  const side = value.origin === null ? null : value.origin === "overseas" ? "abroad" : "japan";
  const box = "tap-target flex min-h-28 w-full items-center justify-center rounded-lg border-2 border-line bg-paper p-4 text-center text-xl font-bold text-ink hover:bg-surface";

  if (side === null) {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-bold">{t`どちらからお越しですか？`}</legend>
        <p className="-mt-1 text-base text-muted">{t`答えなくても大丈夫です。`}</p>
        <button type="button" onClick={() => onChange({ origin: OTHER_JAPAN, place: null })} className={box}>
          {t`日本から来ました`}
        </button>
        <button type="button" onClick={() => onChange({ origin: "overseas", place: null })} className={box}>
          {t`海外から来ました`}
        </button>
      </fieldset>
    );
  }

  const pick = (code: string) => onChange(code ? { origin: originOfPlace(code), place: code } : { origin: side === "japan" ? OTHER_JAPAN : "overseas", place: null });
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="origin-place" className="text-lg font-bold">
        {side === "japan" ? t`都道府県を選択してください` : t`国を選択してください`}
      </label>
      <p className="-mt-2 text-base text-muted">{t`答えなくても大丈夫です。`}</p>
      <select id="origin-place" value={place ?? ""} onChange={(e) => pick(e.target.value)} className={inputClass}>
        <option value="">{t`選んでください`}</option>
        {side === "japan"
          ? PREFECTURE_REGIONS.map((region) => (
              <optgroup key={region.ja} label={regionName(region, locale)}>
                {region.prefectures.map((p) => (
                  <option key={p.code} value={p.code}>
                    {regionName(p, locale)}
                  </option>
                ))}
              </optgroup>
            ))
          : COUNTRY_REGIONS.map((region) => (
              <optgroup key={region.ja} label={regionName(region, locale)}>
                {countryOptions(region.countries, locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
      <button type="button" onClick={() => onChange({ origin: null, place: null })} className="tap-target w-fit text-base font-bold underline underline-offset-4">
        {t`選びなおす`}
      </button>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { origins, type AuthFailure, type Origin } from "@/lib/auth-flow";
import { useErrorMessages } from "../useErrorMessages";

import { buttonStyle } from "@/components/button";
// Pieces shared by the login, register and profile screens. Big targets, few words, one action per step.

export const primaryButton =
  buttonStyle("primary", "lg", "flex w-full");
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
      className={`tap-target flex min-h-[5rem] w-full items-center gap-4 rounded-2xl p-4 text-left disabled:opacity-60 ${
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
    other_japan: t`日本のほかの地域`,
    overseas: t`海外`,
  };
}

/** "Where do you come from": big tiles, two to a row. Tapping the chosen one again clears it (optional). */
export function OriginPicker({ value, onChange }: { value: Origin | null; onChange: (value: Origin | null) => void }) {
  const { t } = useLingui();
  const names = useOriginNames();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-bold">{t`どちらからお越しですか？`}</legend>
      <p className="-mt-1 text-base text-muted">{t`答えなくても大丈夫です。`}</p>
      <div className="grid grid-cols-2 gap-2">
        {origins.map((origin, index) => {
          const on = value === origin;
          return (
            <label
              key={origin}
              className={`tap-target flex cursor-pointer items-center justify-center rounded-xl border-2 px-2 py-3 text-center text-lg font-bold leading-tight focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-accent ${
                on ? "border-brand bg-brand text-on-brand" : "border-line bg-paper text-ink"
              } ${index === origins.length - 1 && origins.length % 2 === 1 ? "col-span-2" : ""}`}
            >
              <input
                type="radio"
                name="origin"
                value={origin}
                checked={on}
                onChange={() => onChange(origin)}
                onClick={() => on && onChange(null)}
                className="sr-only"
              />
              {names[origin]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

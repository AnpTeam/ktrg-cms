"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { inputClass } from "./authUi";

/** A password box with a big "show it" switch: typing unseen on a phone is the hardest part of a password. */
export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const { t } = useLingui();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2 text-lg font-bold">
        {label}
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          className={inputClass}
        />
      </label>
      {hint ? <p className="text-base text-muted">{hint}</p> : null}
      <label className="tap-target flex w-fit cursor-pointer items-center gap-3 text-lg">
        <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} className="size-6" />
        {t`パスワードを表示する`}
      </label>
    </div>
  );
}

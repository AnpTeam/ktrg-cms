"use client";

import { useLingui } from "@lingui/react/macro";
import { origins, type AuthFailure, type Origin } from "@/lib/auth-flow";

// Pieces shared by the login and register screens. Big targets, plain words, one action per step.

export const primaryButton =
  "tap-target flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-brand px-6 text-xl font-bold text-on-brand disabled:opacity-60";
export const secondaryButton =
  "tap-target flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface disabled:opacity-60";
export const inputClass =
  "tap-target w-full rounded-xl border-2 border-ink bg-paper px-4 text-xl text-ink placeholder:text-muted";

/** The visitor-facing sentence for each failure. */
export function useFailureMessages(): Record<AuthFailure, string> {
  const { t } = useLingui();
  return {
    unsupported: t`この端末・ブラウザではパスキーを使えません。メールでお試しください。`,
    cancelled: t`パスキーの確認が中止されました。もう一度お試しください。`,
    invalid_display_name: t`お名前に使えない文字が含まれているか、長すぎます（40文字まで）。`,
    invalid_code: t`番号が違うか、期限が切れています。もう一度お試しください。`,
    login_failed: t`ログインできませんでした。この端末にパスキーがないときは、メールでログインしてください。`,
    registration_failed: t`登録できませんでした。もう一度お試しください。`,
    too_many_requests: t`短い間に何度も操作されました。しばらくしてからお試しください。`,
    network: t`通信できませんでした。電波の良い場所でもう一度お試しください。`,
    failed: t`問題が発生しました。しばらくしてからもう一度お試しください。`,
  };
}

export function AuthError({ code }: { code: AuthFailure | null }) {
  const messages = useFailureMessages();
  if (!code) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-danger p-3 text-lg font-bold text-danger">
      {messages[code]}
    </p>
  );
}

/** "Where do you come from": one big choice per row, a real radio group. */
export function OriginPicker({ value, onChange }: { value: Origin | null; onChange: (value: Origin | null) => void }) {
  const { t } = useLingui();
  const names: Record<Origin, string> = {
    osaka: t`大阪府`,
    wakayama: t`和歌山県`,
    nara: t`奈良県`,
    other_japan: t`日本のほかの地域`,
    overseas: t`海外`,
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-bold">{t`どちらからお越しですか？（答えなくても大丈夫です）`}</legend>
      {origins.map((origin) => {
        const on = value === origin;
        return (
          <label
            key={origin}
            className={`tap-target flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-xl ${
              on ? "border-accent bg-surface font-bold" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="origin"
              value={origin}
              checked={on}
              // Tapping the chosen one again clears it: the question is optional.
              onChange={() => onChange(origin)}
              onClick={() => on && onChange(null)}
              className="size-6 accent-[var(--color-accent)]"
            />
            {names[origin]}
          </label>
        );
      })}
    </fieldset>
  );
}

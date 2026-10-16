"use client";

import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { requestEmailCode, type AuthResult } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { AuthError, inputClass, primaryButton, secondaryButton } from "./authUi";

/**
 * The second half of signing in by email: the 6-digit code that was mailed. `onSubmit` runs the
 * actual check (login or register); this only collects the number and offers to send it again.
 */
export function EmailCodeStep({
  email,
  locale,
  submitLabel,
  onSubmit,
  onBack,
}: {
  email: string;
  locale: "ja" | "en";
  submitLabel: string;
  onSubmit: (code: string) => Promise<AuthResult>;
  onBack: () => void;
}) {
  const { t } = useLingui();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(code) || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit(code);
    // On success the caller moves to the next page; only a failure comes back here.
    if (!result.ok) {
      setError(result.code);
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const result = await requestEmailCode(email, locale);
    setBusy(false);
    if (result.ok) setResent(true);
    else setError(result.code);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-lg">{t`${email} に6桁の番号を送りました。メールに書かれた番号を入力してください。`}</p>
      <label className="flex flex-col gap-2 text-lg font-bold">
        {t`確認番号（6桁）`}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="123456"
          className={`${inputClass} text-center text-3xl tracking-[0.3em]`}
        />
      </label>
      <AuthError code={error} />
      {resent ? (
        <p role="status" className="text-lg">
          {t`もう一度送りました。届かないときは1分ほど待ってからお試しください。`}
        </p>
      ) : null}
      <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
        {submitLabel}
      </button>
      <button type="button" onClick={resend} disabled={busy} className={secondaryButton}>
        {t`番号をもう一度送る`}
      </button>
      <button type="button" onClick={onBack} className={`${secondaryButton} border-line`}>
        {t`メールアドレスを直す`}
      </button>
    </form>
  );
}

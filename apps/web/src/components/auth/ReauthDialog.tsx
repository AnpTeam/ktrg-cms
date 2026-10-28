"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { listPasskeys, passkeysSupported, reauthWithPasskey, requestReauthCode, verifyReauthCode, type AuthResult } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { AuthError, inputClass, primaryButton, secondaryButton } from "./authUi";

/**
 * "Confirm it is you again": shown before a sensitive action (adding or removing a passkey, deleting the account)
 * when the last login is more than 10 minutes old. The visitor proves it with the phone's face, fingerprint or lock
 * code (a passkey check), or with a 6-digit number sent to their email. It never appears right after logging in.
 */
function ReauthSteps({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useLingui();
  const [step, setStep] = useState<"choose" | "code">("choose");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  // The passkey check is offered only to someone who has a passkey; anyone else (adding their first one) gets the email code.
  const [hasPasskey, setHasPasskey] = useState(false);
  const supported = passkeysSupported() && hasPasskey;

  useEffect(() => {
    let live = true;
    if (passkeysSupported()) void listPasskeys().then((res) => live && res.ok && setHasPasskey(res.passkeys.length > 0));
    return () => {
      live = false;
    };
  }, []);

  async function run(action: () => Promise<AuthResult>, then: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) then();
    else setError(result.code);
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(code)) return;
    void run(() => verifyReauthCode(code), onDone);
  }

  return (
    <>
      <h2 id="reauth-title" className="text-2xl font-bold">
        {t`本人かどうか、確認します`}
      </h2>
      <p className="mt-3 text-lg leading-8">{t`大切な操作なので、もう一度、確認します。`}</p>

      {step === "choose" ? (
        <div className="mt-5 flex flex-col gap-3">
          <AuthError code={error} />
          {supported ? (
            <button type="button" disabled={busy} onClick={() => void run(reauthWithPasskey, onDone)} className={primaryButton}>
              {t`顔・指紋・ロック番号で確認`}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(requestReauthCode, () => setStep("code"))}
            className={supported ? secondaryButton : primaryButton}
          >
            {t`メールの番号で確認`}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={`${secondaryButton} border-line`}>
            {t`やめる`}
          </button>
        </div>
      ) : (
        <form onSubmit={submitCode} className="mt-5 flex flex-col gap-4" noValidate>
          <p className="text-lg">{t`メールに、6桁の番号を送りました。`}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="123456"
            aria-label={t`確認番号`}
            className={`${inputClass} text-center text-3xl tracking-[0.3em]`}
          />
          <AuthError code={error} />
          <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
            {t`確認する`}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={`${secondaryButton} border-line`}>
            {t`やめる`}
          </button>
        </form>
      )}
    </>
  );
}

export function ReauthDialog({ open, onDone, onCancel }: { open: boolean; onDone: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // A new key each time it opens, so the steps start again from the first one.
  const [round, setRound] = useState(0);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setRound((n) => n + 1);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="reauth-title"
      onClose={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
    >
      {open ? <ReauthSteps key={round} onDone={onDone} onCancel={onCancel} /> : null}
    </dialog>
  );
}

/**
 * Wrap a sensitive action: `guard(action)` runs it, and if the server says a fresh login is needed it shows the
 * dialog and, once the visitor has confirmed, runs the action again. If they back out the result is
 * `{ ok: false, code: "cancelled" }`, which the caller should not show as an error.
 */
export function useReauth(): { guard: (action: () => Promise<AuthResult>) => Promise<AuthResult>; dialog: ReactNode } {
  const [open, setOpen] = useState(false);
  const waiting = useRef<((confirmed: boolean) => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiting.current = resolve;
        setOpen(true);
      }),
    [],
  );
  const finish = useCallback((confirmed: boolean) => {
    setOpen(false);
    waiting.current?.(confirmed);
    waiting.current = null;
  }, []);

  const guard = useCallback(
    async (action: () => Promise<AuthResult>): Promise<AuthResult> => {
      const first = await action();
      if (first.ok || first.code !== "reauth_required") return first;
      if (!(await ask())) return { ok: false, code: "cancelled" };
      return action();
    },
    [ask],
  );

  return { guard, dialog: <ReauthDialog open={open} onDone={() => finish(true)} onCancel={() => finish(false)} /> };
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AuthError, primaryButton, secondaryButton } from "@/components/auth/authUi";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useReauth } from "@/components/auth/ReauthDialog";
import { api } from "@/lib/api";
import { removePassword, setPassword } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { confirmDialog } from "@/components/ConfirmDialog";

/** The optional password on the login methods screen. Staff accounts cannot have one, so they do not see this. */
export function PasswordMethod({ hasEmail }: { hasEmail: boolean }) {
  const { t } = useLingui();
  const [state, setState] = useState<{ hasPassword: boolean; allowed: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { guard, dialog } = useReauth();

  useEffect(() => {
    let current = true;
    void api.auth.password
      .get()
      .then((res) => {
        if (current && res.data?.ok) setState({ hasPassword: res.data.hasPassword, allowed: res.data.allowed });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  if (!state?.allowed) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !typed) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await guard(() => setPassword(typed));
    setBusy(false);
    if (!res.ok) return setError(res.code === "cancelled" ? null : res.code);
    setState({ hasPassword: true, allowed: true });
    setEditing(false);
    setTyped("");
    setDone(t`パスワードを保存しました。確認のメールを送りました。`);
  }

  async function remove() {
    if (busy || !(await confirmDialog({ title: t`パスワードを消しますか？`, body: t`メールの番号や顔・指紋では、これまでどおりログインできます。`, yes: t`消す` }))) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await guard(removePassword);
    setBusy(false);
    if (!res.ok) return setError(res.code === "cancelled" ? null : res.code);
    setState({ hasPassword: false, allowed: true });
    setDone(t`パスワードを消しました。`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <h2 className="text-2xl font-bold">{t`パスワード`}</h2>
      {!hasEmail ? (
        <p className="text-lg">{t`パスワードを使うには、先にメールアドレスを追加してください。忘れたときに、メールで確認するためです。`}</p>
      ) : (
        <>
          <p className="text-lg">
            {state.hasPassword
              ? t`パスワードを設定しています。忘れたときは、メールの番号でログインして、ここで決めなおせます。`
              : t`パスワードは、なくてもかまいません。決めておくと、メールを待たずにログインできます。`}
          </p>
          {done ? (
            <p role="status" className="text-lg font-bold">
              {done}
            </p>
          ) : null}
          <AuthError code={error} />
          {editing || !state.hasPassword ? (
            <form onSubmit={save} className="flex flex-col gap-4" noValidate>
              <PasswordInput label={t`新しいパスワード`} value={typed} onChange={setTyped} autoComplete="new-password" hint={t`8文字以上にしてください。記号はなくてもかまいません。`} />
              <button type="submit" disabled={busy || !typed} className={primaryButton}>
                {t`パスワードを保存する`}
              </button>
              {editing ? (
                <button type="button" onClick={() => setEditing(false)} className={secondaryButton}>
                  {t`やめる`}
                </button>
              ) : null}
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
                {t`パスワードを変える`}
              </button>
              <button type="button" onClick={remove} disabled={busy} className={secondaryButton}>
                {t`パスワードを消す`}
              </button>
            </div>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { undoPassword } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { AuthError, primaryButton } from "./authUi";

/**
 * Where the "this was not me" button in a password email lands. It only acts on a press of the button here: mail scanners
 * open links, so opening the page must change nothing. The token is in the address after the #, which no server sees.
 */
export function PasswordUndo() {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  async function undo() {
    setBusy(true);
    setError(null);
    const res = await undoPassword(window.location.hash.slice(1));
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.code);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-lg font-bold">{t`パスワードを消して、すべての端末からログアウトしました。`}</p>
        <p className="text-lg">{t`メールの番号でログインしなおして、ログインの方法を確認してください。`}</p>
        <Link href="/login" className="tap-target w-fit text-lg font-bold">
          {t`ログイン`}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg">{t`パスワードの変更に心当たりがないときは、下のボタンを押してください。パスワードを消して、すべての端末からログアウトします。`}</p>
      <AuthError code={error} />
      <button type="button" onClick={undo} disabled={busy} className={primaryButton}>
        {t`パスワードを消してログアウトする`}
      </button>
    </div>
  );
}

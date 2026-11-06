"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AuthError, inputClass, primaryButton } from "@/components/auth/authUi";
import { EmailCodeStep } from "@/components/auth/EmailCodeStep";
import { useReauth } from "@/components/auth/ReauthDialog";
import { PasskeyManager } from "@/components/settings/PasskeyManager";
import { api } from "@/lib/api";
import { requestAddEmail, verifyAddEmail } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";

// Every way to log in to this account on one screen: the email (shown, or added when the account was made with a
// passkey alone) and the passkeys. An account must always keep one of them, so each side needs the other.

function EmailMethod({ email, locale, onAdded }: { email: string | null; locale: "ja" | "en"; onAdded: (email: string) => void }) {
  const { t } = useLingui();
  const [typed, setTyped] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const { guard, dialog } = useReauth();

  if (email) {
    return (
      <div className="rounded-3xl bg-surface p-4">
        <p className="text-lg text-muted">{t`メールアドレス`}</p>
        <p className="break-all text-xl font-bold">{email}</p>
      </div>
    );
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const address = typed.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    const res = await guard(() => requestAddEmail(address));
    if (res.ok) setSentTo(address);
    else setError(res.code === "cancelled" ? null : res.code);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <h2 className="text-2xl font-bold">{t`メールアドレスを追加する`}</h2>
      <p className="text-lg">{t`いまは、顔・指紋だけでログインしています。メールを追加すると、端末をなくしても、メールの番号でログインできます。`}</p>
      {sentTo ? (
        <EmailCodeStep
          email={sentTo}
          locale={locale}
          submitLabel={t`メールを追加する`}
          onBack={() => setSentTo(null)}
          onSubmit={async (code) => {
            const res = await guard(() => verifyAddEmail(sentTo, code));
            if (res.ok) onAdded(sentTo);
            return res;
          }}
        />
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-2 text-lg font-bold">
            {t`メールアドレス`}
            <input
              type="email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              className={inputClass}
            />
          </label>
          <AuthError code={error} />
          <button type="submit" disabled={busy || !typed.trim()} className={primaryButton}>
            {t`確認の番号を送る`}
          </button>
        </form>
      )}
      {dialog}
    </div>
  );
}

export function LoginMethods({ locale }: { locale: string }) {
  const language = locale === "en" ? "en" : "ja";
  // undefined while asking the server; an unknown answer never blocks, the server has the last word.
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    void api.me
      .get()
      .then((res) => {
        if (current && res.data?.ok) setEmail(res.data.me.email);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {email !== undefined ? <EmailMethod email={email} locale={language} onAdded={setEmail} /> : null}
      <PasskeyManager locale={locale} hasEmail={email !== null} />
    </div>
  );
}

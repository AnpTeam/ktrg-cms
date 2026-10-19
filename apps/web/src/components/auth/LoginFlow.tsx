"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { KeyIcon, MailIcon } from "@/components/icons";
import { logInWithPasskey, requestEmailCode, verifyEmailCode } from "@/lib/auth-client";
import { safeNextPath, type AuthFailure } from "@/lib/auth-flow";
import { AuthError, ChoiceCard, inputClass, primaryButton, secondaryButton } from "./authUi";
import { EmailCodeStep } from "./EmailCodeStep";

type Step = "choose" | "email" | "code";

/** Log in: two big tiles, a passkey (face or fingerprint, no typing) or an emailed number. */
export function LoginFlow({ next, registerHref }: { next?: string; registerHref: string }) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const locale = i18n.locale === "en" ? "en" : "ja";
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  const finish = () => {
    router.replace(safeNextPath(next, `/${locale}`));
    router.refresh(); // the header and pages now see the session
  };

  async function withPasskey() {
    setBusy(true);
    setError(null);
    const result = await logInWithPasskey();
    if (result.ok) return finish();
    setError(result.code);
    setBusy(false);
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setError(null);
    const result = await requestEmailCode(email.trim(), locale);
    setBusy(false);
    if (result.ok) setStep("code");
    else setError(result.code);
  }

  if (step === "code") {
    return (
      <EmailCodeStep
        email={email.trim()}
        locale={locale}
        submitLabel={t`ログイン`}
        onBack={() => setStep("email")}
        onSubmit={async (code) => {
          const result = await verifyEmailCode(email.trim(), code);
          if (result.ok) finish();
          return result;
        }}
      />
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-6" noValidate>
        <label className="flex flex-col gap-2 text-lg font-bold">
          {t`メールアドレス`}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoFocus
            maxLength={254}
            placeholder="name@example.com"
            className={inputClass}
          />
        </label>
        <AuthError code={error} />
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy || !email.includes("@")} className={primaryButton}>
            {t`確認番号を送る`}
          </button>
          <button type="button" onClick={() => setStep("choose")} className={secondaryButton}>
            {t`戻る`}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChoiceCard primary icon={<KeyIcon />} title={t`顔・指紋でログイン`} onClick={withPasskey} disabled={busy} />
      <AuthError code={error} />
      <ChoiceCard icon={<MailIcon />} title={t`メールでログイン`} onClick={() => setStep("email")} />
      <p className="mt-2 text-lg">
        {t`はじめての方は`}{" "}
        <Link href={registerHref} className="font-bold">
          {t`新規登録`}
        </Link>
      </p>
    </div>
  );
}

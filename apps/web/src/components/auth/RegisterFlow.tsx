"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { KeyIcon, MailIcon } from "@/components/icons";
import { requestEmailCode, signUpWithPasskey, verifyEmailCode, type SignupProfile } from "@/lib/auth-client";
import { hasName, NAME_MAX, safeNextPath, type AuthFailure, type Origin } from "@/lib/auth-flow";
import { AuthError, inputClass, OriginPicker, primaryButton, secondaryButton } from "./authUi";
import { EmailCodeStep } from "./EmailCodeStep";

type Method = "passkey" | "email";
type Step = "choose" | "details" | "code";

/**
 * Register, as short as it can be: pick a way (passkey or email), say a name and where you come
 * from, then do the passkey scan or type the mailed code. The account is only created at the end.
 */
export function RegisterFlow({ next, loginHref }: { next?: string; loginHref: string }) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const locale = i18n.locale === "en" ? "en" : "ja";
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<Method>("passkey");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  const profile = (): SignupProfile => ({ displayName: name.trim(), origin, locale });
  const finish = () => {
    router.replace(safeNextPath(next, `/${locale}`));
    router.refresh();
  };
  const choose = (m: Method) => {
    setMethod(m);
    setError(null);
    setStep("details");
  };

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    if (busy || !hasName(name)) return;
    setBusy(true);
    setError(null);
    if (method === "passkey") {
      const result = await signUpWithPasskey(profile());
      if (result.ok) return finish();
      setError(result.code);
      setBusy(false);
      return;
    }
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
        submitLabel={t`登録する`}
        onBack={() => setStep("details")}
        onSubmit={async (code) => {
          const result = await verifyEmailCode(email.trim(), code, profile());
          if (result.ok) finish();
          return result;
        }}
      />
    );
  }

  if (step === "details") {
    const ready = hasName(name) && (method === "passkey" || email.includes("@"));
    return (
      <form onSubmit={submitDetails} className="flex flex-col gap-5" noValidate>
        <label className="flex flex-col gap-2 text-lg font-bold">
          {t`お名前（ニックネームでもかまいません）`}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            autoFocus
            maxLength={NAME_MAX}
            className={inputClass}
          />
        </label>
        <OriginPicker value={origin} onChange={setOrigin} />
        {method === "email" ? (
          <label className="flex flex-col gap-2 text-lg font-bold">
            {t`メールアドレス`}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="name@example.com"
              className={inputClass}
            />
          </label>
        ) : null}
        <AuthError code={error} />
        <button type="submit" disabled={busy || !ready} className={primaryButton}>
          {method === "passkey" ? (
            <>
              <KeyIcon />
              {t`パスキーを作って登録`}
            </>
          ) : (
            t`確認番号を送る`
          )}
        </button>
        {method === "passkey" ? (
          <p className="text-lg text-muted">{t`次の画面で、顔や指紋などで本人確認をします。`}</p>
        ) : null}
        <button type="button" onClick={() => setStep("choose")} className={secondaryButton}>
          {t`戻る`}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => choose("passkey")} className={primaryButton}>
        <KeyIcon />
        {t`パスキーで登録（おすすめ）`}
      </button>
      <p className="text-lg text-muted">{t`顔や指紋で、すぐに登録できます。パスワードは要りません。`}</p>
      <button type="button" onClick={() => choose("email")} className={secondaryButton}>
        <MailIcon />
        {t`メールで登録`}
      </button>
      <p className="text-lg text-muted">{t`メールに届く6桁の番号で登録します。`}</p>
      <p className="mt-2 text-lg">
        {t`登録済みの方は`}{" "}
        <Link href={loginHref} className="font-bold">
          {t`ログイン`}
        </Link>
      </p>
    </div>
  );
}

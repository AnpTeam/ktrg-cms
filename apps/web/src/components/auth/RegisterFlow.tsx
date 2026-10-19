"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { KeyIcon, MailIcon } from "@/components/icons";
import { requestEmailCode, signUpWithPasskey, verifyEmailCode, type SignupProfile } from "@/lib/auth-client";
import { hasName, NAME_MAX, safeNextPath, type AuthFailure, type Origin } from "@/lib/auth-flow";
import { PrivacyNote } from "@/components/PrivacyNote";
import { AuthError, ChoiceCard, inputClass, OriginPicker, primaryButton, secondaryButton } from "./authUi";
import { EmailCodeStep } from "./EmailCodeStep";

type Method = "passkey" | "email";
type Step = "choose" | "details" | "code";

/**
 * Register, with as few words as possible: two big tiles to pick a way (face or fingerprint, or
 * email), then a name and where you come from, then the scan or the mailed number. The account is
 * only created at the end.
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
  // A new account meets the set-up screen first (how big, how the map looks), then goes where it was going.
  const finish = () => {
    const after = safeNextPath(next, `/${locale}`);
    router.replace(`/${locale}/welcome?next=${encodeURIComponent(after)}`);
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
      <form onSubmit={submitDetails} className="flex flex-col gap-6" noValidate>
        <label className="flex flex-col gap-2 text-lg font-bold">
          {t`お名前`}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            autoFocus
            maxLength={NAME_MAX}
            className={inputClass}
          />
          <span className="text-base font-normal text-muted">{t`ニックネームでもかまいません。`}</span>
        </label>
        <OriginPicker value={origin} onChange={setOrigin} />
        <PrivacyNote />
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
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy || !ready} className={primaryButton}>
            {method === "passkey" ? (
              <>
                <KeyIcon />
                {t`顔・指紋で登録する`}
              </>
            ) : (
              t`確認番号を送る`
            )}
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
      <ChoiceCard primary icon={<KeyIcon />} title={t`顔・指紋で登録`} onClick={() => choose("passkey")} />
      <ChoiceCard icon={<MailIcon />} title={t`メールで登録`} onClick={() => choose("email")} />
      <p className="mt-2 text-lg">
        {t`登録済みの方は`}{" "}
        <Link href={loginHref} className="font-bold">
          {t`ログイン`}
        </Link>
      </p>
    </div>
  );
}

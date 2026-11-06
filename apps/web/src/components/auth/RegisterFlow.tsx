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

type Step = "choose" | "details" | "name" | "origin" | "email" | "code";

/** The email way asks one thing per screen; the mailed number is the last of these. */
const EMAIL_STEPS = 4;

/**
 * Register, with as few words as possible: two big tiles to pick a way. Face or fingerprint is one screen (a name and
 * where you come from) and then the scan. Email goes one question at a time, for people who find a long form hard: a
 * name, where you come from, the address, the mailed number. The account is only created at the end.
 */
export function RegisterFlow({ next, loginHref }: { next?: string; loginHref: string }) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const locale = i18n.locale === "en" ? "en" : "ja";
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  const profile = (): SignupProfile => ({ displayName: name.trim(), origin, locale });
  // A new account meets the set-up screen first (how big, how the map looks), then goes where it was going.
  const finish = () => {
    const after = safeNextPath(next, "/");
    router.replace(`/welcome?next=${encodeURIComponent(after)}`);
    router.refresh();
  };
  const go = (to: Step) => {
    setError(null);
    setStep(to);
  };

  async function submitPasskey(e: FormEvent) {
    e.preventDefault();
    if (busy || !hasName(name)) return;
    setBusy(true);
    setError(null);
    const result = await signUpWithPasskey(profile());
    if (result.ok) return finish();
    setError(result.code);
    setBusy(false);
  }

  async function sendCode() {
    if (busy || !hasName(name) || !email.includes("@")) return;
    setBusy(true);
    setError(null);
    const result = await requestEmailCode(email.trim(), locale);
    setBusy(false);
    if (result.ok) setStep("code");
    else setError(result.code);
  }

  const nameField = (
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
  );
  const stepCount = (n: number) => <p className="text-lg font-bold text-muted">{n} / {EMAIL_STEPS}</p>;

  if (step === "code") {
    return (
      <div className="flex flex-col gap-6">
        {stepCount(EMAIL_STEPS)}
        <EmailCodeStep
          email={email.trim()}
          locale={locale}
          submitLabel={t`登録する`}
          onBack={() => go("email")}
          onSubmit={async (code) => {
            const result = await verifyEmailCode(email.trim(), code, profile());
            if (result.ok) finish();
            return result;
          }}
        />
      </div>
    );
  }

  if (step === "name" || step === "origin" || step === "email") {
    const number = { name: 1, origin: 2, email: 3 }[step];
    const ready = step === "name" ? hasName(name) : step === "origin" || email.includes("@");
    const forward = (e: FormEvent) => {
      e.preventDefault();
      if (!ready) return;
      if (step === "email") void sendCode();
      else go(step === "name" ? "origin" : "email");
    };
    return (
      <form onSubmit={forward} className="flex flex-col gap-6" noValidate>
        {stepCount(number)}
        {step === "name" ? nameField : null}
        {step === "origin" ? (
          <>
            <OriginPicker value={origin} onChange={setOrigin} />
            <PrivacyNote />
          </>
        ) : null}
        {step === "email" ? (
          <label className="flex flex-col gap-2 text-lg font-bold">
            {t`メールアドレス`}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
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
            {step === "email" ? t`確認番号を送る` : t`つぎへ`}
          </button>
          <button type="button" onClick={() => go(step === "name" ? "choose" : step === "origin" ? "name" : "origin")} className={secondaryButton}>
            {t`戻る`}
          </button>
        </div>
      </form>
    );
  }

  if (step === "details") {
    return (
      <form onSubmit={submitPasskey} className="flex flex-col gap-6" noValidate>
        {nameField}
        <OriginPicker value={origin} onChange={setOrigin} />
        <PrivacyNote />
        <AuthError code={error} />
        <p className="text-base text-muted">{t`ほかのアプリに保存するときは、表示される画面で選んでください。`}</p>
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy || !hasName(name)} className={primaryButton}>
            <KeyIcon />
            {t`顔・指紋で登録する`}
          </button>
          <button type="button" onClick={() => go("choose")} className={secondaryButton}>
            {t`戻る`}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChoiceCard primary icon={<KeyIcon />} title={t`顔・指紋で登録`} onClick={() => go("details")} />
      <ChoiceCard icon={<MailIcon />} title={t`メールで登録`} onClick={() => go("name")} />
      <p className="mt-2 text-lg">
        {t`登録済みの方は`}{" "}
        <Link href={loginHref} className="font-bold">
          {t`ログイン`}
        </Link>
      </p>
    </div>
  );
}

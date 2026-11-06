"use client";

import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AgeRangePicker, FoundViaPicker, GenderPicker } from "@/components/auth/AboutYou";
import { AuthError, primaryButton, secondaryButton } from "@/components/auth/authUi";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useReauth } from "@/components/auth/ReauthDialog";
import { PrefsForm } from "@/components/settings/PrefsForm";
import { PrivacyNote } from "@/components/PrivacyNote";
import { api } from "@/lib/api";
import { setPassword } from "@/lib/auth-client";
import type { AgeRange, AuthFailure, FoundVia, Gender } from "@/lib/auth-flow";
import type { Prefs } from "@/lib/prefs";

/**
 * The first screens after registering. An account with an email is first offered a password, which it can skip. Then a few optional questions about the person (age band and gender,
 * with "答えたくない" as a real answer), then how big things should be and how the map shows places.
 * People use this app over many outings, so it is worth asking once; nothing here is required, and it can
 * all be changed later (profile on the stamp page, 見やすさの設定 in the menu).
 */
export function WelcomeFlow({
  initial,
  signedIn,
  next,
  askAbout,
  askPassword,
}: {
  initial: Prefs;
  signedIn: boolean;
  next: string;
  /** False when both questions were already answered. */
  askAbout: boolean;
  /** Offer a password first: a new visitor's account with an email. Staff cannot have one. */
  askPassword: boolean;
}) {
  const { t } = useLingui();
  const [step, setStep] = useState<"password" | "about" | "prefs">(askPassword ? "password" : askAbout ? "about" : "prefs");
  const [password, setTypedPassword] = useState("");
  const { guard, dialog } = useReauth();
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [foundVia, setFoundVia] = useState<FoundVia | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  async function saveAbout() {
    if (busy) return;
    // Only what was chosen is sent: an unanswered question stays unanswered.
    const body = { ...(ageRange ? { ageRange } : {}), ...(gender ? { gender } : {}), ...(foundVia ? { foundVia } : {}) };
    if (signedIn && Object.keys(body).length > 0) {
      setBusy(true);
      setError(null);
      try {
        const res = await api.me.patch(body);
        if (res.error) {
          setError("network");
          setBusy(false);
          return;
        }
      } catch {
        setError("network");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setStep("prefs");
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    const res = await guard(() => setPassword(password));
    setBusy(false);
    if (res.ok) setStep("about");
    else setError(res.code === "cancelled" ? null : res.code);
  }

  if (step === "password") {
    return (
      <form onSubmit={savePassword} className="flex flex-col gap-6" noValidate>
        <h1 className="font-serif text-3xl font-bold">{t`パスワードを決めますか？`}</h1>
        <p className="text-lg">{t`決めなくても大丈夫です。決めておくと、メールを待たずにログインできます。あとから「ログインの方法」でも決められます。`}</p>
        <PasswordInput label={t`パスワード`} value={password} onChange={setTypedPassword} autoComplete="new-password" hint={t`8文字以上にしてください。記号はなくてもかまいません。`} />
        <AuthError code={error} />
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy || !password} className={primaryButton}>
            {t`パスワードを保存する`}
          </button>
          <button type="button" disabled={busy} onClick={() => { setError(null); setStep("about"); }} className={secondaryButton}>
            {t`パスワードなしで続ける`}
          </button>
        </div>
        {dialog}
      </form>
    );
  }

  if (step === "about") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-3xl font-bold">{t`登録ありがとうございます`}</h1>
        <p className="text-lg">{t`あなたのことを、少しだけ教えてください。答えなくても大丈夫です。あとから変えられます。`}</p>
        <AgeRangePicker value={ageRange} onChange={setAgeRange} />
        <GenderPicker value={gender} onChange={setGender} />
        <FoundViaPicker value={foundVia} onChange={setFoundVia} />
        <PrivacyNote />
        <AuthError code={error} />
        <div className="flex flex-col gap-3">
          <button type="button" disabled={busy} onClick={saveAbout} className={primaryButton}>
            {t`つぎへ`}
          </button>
          <button type="button" disabled={busy} onClick={() => setStep("prefs")} className={secondaryButton}>
            {t`あとで答える`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-bold">{askAbout ? t`見やすさを選びましょう` : t`登録ありがとうございます`}</h1>
      <p className="text-lg">{t`見やすさを、あなたに合わせましょう。大きさは、選ぶとすぐに変わります。`}</p>
      <PrefsForm initial={initial} signedIn={signedIn} mode="setup" next={next} />
    </div>
  );
}

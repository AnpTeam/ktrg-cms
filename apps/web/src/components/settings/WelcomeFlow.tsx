"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { AgeRangePicker, GenderPicker } from "@/components/auth/AboutYou";
import { AuthError, primaryButton, secondaryButton } from "@/components/auth/authUi";
import { PrefsForm } from "@/components/settings/PrefsForm";
import { PrivacyNote } from "@/components/PrivacyNote";
import { api } from "@/lib/api";
import type { AgeRange, AuthFailure, Gender } from "@/lib/auth-flow";
import type { Prefs } from "@/lib/prefs";

/**
 * The first screens after registering. First a few optional questions about the person (age band and gender,
 * with "答えたくない" as a real answer), then how big things should be and how the map shows places.
 * People use this app over many outings, so it is worth asking once; nothing here is required, and it can
 * all be changed later (profile on the stamp page, 見やすさの設定 in the menu).
 */
export function WelcomeFlow({
  initial,
  signedIn,
  next,
  askAbout,
}: {
  initial: Prefs;
  signedIn: boolean;
  next: string;
  /** False when both questions were already answered. */
  askAbout: boolean;
}) {
  const { t } = useLingui();
  const [step, setStep] = useState<"about" | "prefs">(askAbout ? "about" : "prefs");
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  async function saveAbout() {
    if (busy) return;
    // Only what was chosen is sent: an unanswered question stays unanswered.
    const body = { ...(ageRange ? { ageRange } : {}), ...(gender ? { gender } : {}) };
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

  if (step === "about") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-3xl font-bold">{t`登録ありがとうございます`}</h1>
        <p className="text-lg">{t`あなたのことを、少しだけ教えてください。答えなくても大丈夫です。あとから変えられます。`}</p>
        <AgeRangePicker value={ageRange} onChange={setAgeRange} />
        <GenderPicker value={gender} onChange={setGender} />
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

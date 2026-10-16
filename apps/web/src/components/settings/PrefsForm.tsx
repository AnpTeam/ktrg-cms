"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { api } from "@/lib/api";
import { defaultPrefs, prefsCookieString, textSizes, type Prefs, type TextSize } from "@/lib/prefs";
import { primaryButton, secondaryButton } from "@/components/auth/authUi";

/**
 * The accessibility and map choices, used twice: as the Settings page and as the first-time set-up
 * right after registering. Choosing a size changes the whole page at once, so the visitor sees what
 * they are choosing. Saved on this phone (a cookie) and, when signed in, on the account.
 */
export function PrefsForm({
  initial,
  signedIn,
  mode,
  next,
}: {
  initial: Prefs;
  signedIn: boolean;
  mode: "settings" | "setup";
  /** Where to go when the set-up is finished (set-up only). */
  next: string;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Show the chosen size on the whole page straight away; the server writes it on the next page load.
  useEffect(() => {
    document.documentElement.dataset.size = prefs.size;
  }, [prefs.size]);

  const sizes: Record<TextSize, { name: string; hint: string }> = {
    standard: { name: t`ふつう`, hint: t`ふつうの大きさです。` },
    large: { name: t`大きい`, hint: t`文字もボタンも、少し大きくなります。` },
    xlarge: { name: t`とても大きい`, hint: t`文字もボタンも、いちばん大きくなります。` },
  };

  async function save(value: Prefs): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    const toSave: Prefs = { ...value, setupDone: true };
    document.cookie = prefsCookieString(toSave, window.location.protocol === "https:");
    let onAccount = true;
    if (signedIn) {
      try {
        const res = await api.me.patch({ preferences: toSave });
        onAccount = !res.error;
      } catch {
        onAccount = false;
      }
    }
    setSaving(false);
    if (!onAccount) setMessage(t`この端末には保存しました。アカウントには保存できませんでした。`);
    return onAccount;
  }

  async function finishSetup(value: Prefs) {
    const ok = await save(value);
    // The device copy is saved either way, so the set-up is done even if the account could not be reached.
    router.replace(next);
    router.refresh();
    return ok;
  }

  async function saveSettings() {
    const ok = await save(prefs);
    if (ok) setMessage(t`保存しました。`);
    router.refresh();
  }

  const switchRow = (key: "mergeStops" | "placesOnMap", title: string, hint: string) => (
    <label className="tap-target flex cursor-pointer items-start gap-4 rounded-xl border-2 border-line bg-surface p-4">
      <input
        type="checkbox"
        role="switch"
        checked={prefs[key]}
        onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
        className="mt-1 size-7 shrink-0 accent-[var(--color-brand)]"
      />
      <span>
        <span className="block text-xl font-bold">{title}</span>
        <span className="mt-1 block text-lg text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-2xl font-bold">{t`文字とボタンの大きさ`}</legend>
        {textSizes.map((size) => {
          const on = prefs.size === size;
          return (
            <label
              key={size}
              className={`tap-target flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 ${
                on ? "border-brand bg-surface shadow-[inset_0_0_0_2px_var(--color-brand)]" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="size"
                value={size}
                checked={on}
                onChange={() => setPrefs({ ...prefs, size })}
                className="size-7 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                <span className="block text-xl font-bold">{sizes[size].name}</span>
                <span className="block text-lg text-muted">{sizes[size].hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-2xl font-bold">{t`地図の見せ方`}</legend>
        {switchRow(
          "mergeStops",
          t`近い場所をまとめて表示する`,
          t`オフのままだと、スタンプの場所を1つずつ表示します（おすすめ）。オンにすると、近い場所が「3〜5」のようにまとまります。`,
        )}
        {switchRow(
          "placesOnMap",
          t`まわりの場所を最初から出す`,
          t`トイレやお店などを、地図を開いたときから表示します。`,
        )}
      </fieldset>

      {message ? (
        <p role="status" className="rounded-xl border-2 border-line bg-surface p-3 text-lg font-bold">
          {message}
        </p>
      ) : null}

      {mode === "setup" ? (
        <div className="flex flex-col gap-3">
          <button type="button" disabled={saving} onClick={() => finishSetup(prefs)} className={primaryButton}>
            {t`この設定ではじめる`}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => finishSetup({ ...defaultPrefs, setupDone: true })}
            className={secondaryButton}
          >
            {t`あとで決める`}
          </button>
          <p className="text-lg text-muted">{t`あとからでも、「メニュー」の「見やすさの設定」で変えられます。`}</p>
        </div>
      ) : (
        <button type="button" disabled={saving} onClick={saveSettings} className={primaryButton}>
          {t`保存する`}
        </button>
      )}
    </div>
  );
}

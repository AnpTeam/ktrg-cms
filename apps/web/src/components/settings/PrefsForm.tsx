"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { persistPrefs } from "@/lib/prefs-client";
import { defaultPrefs, textSizes, type Prefs, type TextSize } from "@/lib/prefs";
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
    const { dataset } = document.documentElement;
    dataset.size = prefs.size;
    for (const key of ["contrast", "calm", "furigana"] as const) {
      if (prefs[key]) dataset[key] = "";
      else delete dataset[key];
    }
  }, [prefs]);

  const sizes: Record<TextSize, { name: string; hint: string }> = {
    small: { name: t`小さい`, hint: t`文字だけ小さくなります。ボタンの大きさは、ふつうのままです。` },
    standard: { name: t`ふつう`, hint: t`ふつうの大きさです。` },
    large: { name: t`大きい`, hint: t`文字もボタンも、少し大きくなります。` },
    xlarge: { name: t`とても大きい`, hint: t`文字もボタンも、いちばん大きくなります。` },
  };

  async function save(value: Prefs): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    const onAccount = await persistPrefs(value, signedIn);
    setSaving(false);
    if (!onAccount) setMessage(t`この端末には保存しました。つながったときに、アカウントにも保存されます。`);
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

  // One row of a list: the words on the left, the switch on the right.
  const switchRow = (key: "mergeStops" | "placesOnMap" | "furigana" | "contrast" | "calm", title: string, hint: string) => (
    <label className="tap-target flex cursor-pointer items-center gap-4 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{title}</span>
        <span className="mt-0.5 block text-base text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={prefs[key]}
        onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
        className="shrink-0"
      />
    </label>
  );
  const list = "divide-y divide-line/40 overflow-hidden rounded-xl bg-surface";
  // The あ in each size tile, in pixels so the four keep their difference whatever size the page is showing now.
  const sample: Record<TextSize, number> = { small: 18, standard: 24, large: 30, xlarge: 36 };

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-2xl font-bold">{t`文字とボタンの大きさ`}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {textSizes.map((size) => {
            const on = prefs.size === size;
            return (
              <label
                key={size}
                className={`tap-target flex cursor-pointer flex-col items-center justify-end gap-1 rounded-xl border-2 px-2 pb-3 pt-4 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                  on ? "border-brand bg-surface shadow-[inset_0_0_0_2px_var(--color-brand)]" : "border-line bg-paper"
                }`}
              >
                <input type="radio" name="size" value={size} checked={on} onChange={() => setPrefs({ ...prefs, size })} className="sr-only" />
                <span aria-hidden="true" className="font-serif font-bold leading-none" style={{ fontSize: sample[size] }}>
                  あ
                </span>
                <span className="text-lg font-bold">{sizes[size].name}</span>
              </label>
            );
          })}
        </div>
        <p className="text-lg text-muted" aria-live="polite">
          {sizes[prefs.size].hint}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-2xl font-bold">{t`見やすさ`}</legend>
        <div className={list}>
          {switchRow("furigana", t`ふりがなをつける`, t`ページの漢字すべてに、読みがなをつけます。`)}
          {switchRow("contrast", t`くっきり表示`, t`文字と背景の差を大きくし、線を太く、リンクに下線をつけます。`)}
          {switchRow("calm", t`動きをへらす`, t`アニメーションや、ふわっと動く表示をやめます。`)}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-2xl font-bold">{t`地図の見せ方`}</legend>
        <div className={list}>
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
        </div>
      </fieldset>

      {message ? (
        <p role="status" className="rounded-2xl bg-surface p-3 text-lg font-bold">
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

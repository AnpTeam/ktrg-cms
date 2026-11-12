"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { persistPrefs } from "@/lib/prefs-client";
import { setSound, useSound } from "@/lib/stamp-feel";
import type { Prefs } from "@/lib/prefs";

type Toggle = "furigana" | "contrast" | "calm";

/** One row: its name on the left, two choices as a joined pill on the right (as a city site's 標準 | 拡大): the chosen one is ink. */
function Choice({ label, options }: { label: string; options: { text: string; on: boolean; pick: () => void }[] }) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="min-w-0 text-lg font-bold">{label}</span>
      <span className="inline-flex shrink-0 overflow-hidden rounded-full border border-ink">
        {options.map((o) => (
          <button
            key={o.text}
            type="button"
            aria-pressed={o.on}
            onClick={o.pick}
            className={`tap-target min-w-20 px-3 text-base font-bold ${o.on ? "bg-selected text-on-selected" : "bg-paper text-ink hover:bg-surface"}`}
          >
            {o.text}
          </button>
        ))}
      </span>
    </div>
  );
}

/**
 * The accessibility choices people reach for most as five short rows (text size, furigana, contrast, calm, sound), each a
 * two-way pill. They sit in the menu and change the page at once; the full list is in the settings.
 */
export function QuickActions({ prefs, signedIn }: { prefs: Prefs; signedIn: boolean }) {
  const { t } = useLingui();
  const router = useRouter();
  const [current, setCurrent] = useState(prefs);
  const sound = useSound();

  async function change(next: Prefs) {
    setCurrent(next);
    const { dataset } = document.documentElement;
    dataset.size = next.size;
    for (const key of ["contrast", "calm", "furigana"] as const) {
      if (next[key]) dataset[key] = "";
      else delete dataset[key];
    }
    await persistPrefs(next, signedIn);
    router.refresh();
  }
  const flip = (key: Toggle, value: boolean) => current[key] !== value && change({ ...current, [key]: value });
  const grown = current.size === "large" || current.size === "xlarge";

  const none = t`なし`;
  const yes = t`あり`;
  const plain = t`ふつう`;

  return (
    <div role="group" aria-label={t`見やすさのクイック設定`} className="flex flex-col divide-y divide-line/60 overflow-hidden rounded-lg bg-surface">
      <Choice
        label={t`文字サイズ`}
        options={[
          { text: t`標準`, on: current.size === "standard", pick: () => change({ ...current, size: "standard" }) },
          { text: t`拡大`, on: grown, pick: () => !grown && change({ ...current, size: "large" }) },
        ]}
      />
      <Choice label={t`ふりがな`} options={[{ text: none, on: !current.furigana, pick: () => flip("furigana", false) }, { text: yes, on: current.furigana, pick: () => flip("furigana", true) }]} />
      <Choice label={t`配色`} options={[{ text: plain, on: !current.contrast, pick: () => flip("contrast", false) }, { text: t`くっきり`, on: current.contrast, pick: () => flip("contrast", true) }]} />
      <Choice label={t`動き`} options={[{ text: plain, on: !current.calm, pick: () => flip("calm", false) }, { text: none, on: current.calm, pick: () => flip("calm", true) }]} />
      {/* The stamp sound: kept on this device only, off until chosen. */}
      <Choice label={t`音`} options={[{ text: none, on: !sound, pick: () => setSound(false) }, { text: yes, on: sound, pick: () => setSound(true) }]} />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { persistPrefs } from "@/lib/prefs-client";
import { textSizes, type Prefs } from "@/lib/prefs";

type Toggle = "furigana" | "contrast" | "calm";

/**
 * Four big switches for the accessibility choices people reach for most: furigana, text size, contrast, calm. They sit
 * at the top of the menu and change the page at once; the full list is in the settings.
 */
export function QuickActions({ prefs, signedIn }: { prefs: Prefs; signedIn: boolean }) {
  const { t } = useLingui();
  const router = useRouter();
  const [current, setCurrent] = useState(prefs);

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
  const flip = (key: Toggle) => change({ ...current, [key]: !current[key] });
  const bigger = () => change({ ...current, size: textSizes[(textSizes.indexOf(current.size) + 1) % textSizes.length]! });

  const button = (on: boolean) =>
    `tap-target flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1 py-1 text-center text-sm font-bold leading-tight ${on ? "border-brand bg-brand text-on-brand" : "border-line bg-paper text-ink"}`;
  const sizeName = { standard: t`ふつう`, large: t`大`, xlarge: t`特大` }[current.size];

  return (
    <div role="group" aria-label={t`見やすさのクイック設定`} className="flex gap-2">
      <button type="button" aria-pressed={current.furigana} onClick={() => flip("furigana")} className={button(current.furigana)}>
        <span aria-hidden="true" className="text-lg leading-none">あ</span>
        {t`ふりがな`}
      </button>
      <button type="button" onClick={bigger} className={button(current.size !== "standard")} aria-label={t`文字の大きさ: ${sizeName}（押すと変わります）`}>
        <span aria-hidden="true" className="text-lg leading-none">文</span>
        {t`文字 ${sizeName}`}
      </button>
      <button type="button" aria-pressed={current.contrast} onClick={() => flip("contrast")} className={button(current.contrast)}>
        <span aria-hidden="true" className="text-lg leading-none">◐</span>
        {t`くっきり`}
      </button>
      <button type="button" aria-pressed={current.calm} onClick={() => flip("calm")} className={button(current.calm)}>
        <span aria-hidden="true" className="text-lg leading-none">≈</span>
        {t`動きなし`}
      </button>
    </div>
  );
}

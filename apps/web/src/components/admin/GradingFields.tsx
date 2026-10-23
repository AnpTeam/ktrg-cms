"use client";

import { useLingui } from "@lingui/react/macro";
import { isTechnicalLevel, suggestPhysicalLevel, TECHNICAL_LEVELS, type TechnicalLevel } from "@/lib/grading";
import { Field, inputClass } from "./fields";

interface GradingDraft {
  physicalLevel: number | null;
  technicalLevel: TechnicalLevel | null;
  distanceKm: number | null;
  expectedTimeMin: number | null;
  elevationGainM: number | null;
}

/**
 * The two grading levels of a route. The physical level (1 to 10) is suggested from the numbers above (the course
 * constant, see lib/grading.ts) and the editor decides what is saved; the technical level (A to E) is chosen by hand, from
 * what the ground is like.
 */
export function GradingFields({
  draft,
  descentM,
  onPhysical,
  onTechnical,
}: {
  draft: GradingDraft;
  /** Metres walked downhill, from the line's elevations; null when the line has none. */
  descentM: number | null;
  onPhysical: (level: number | null) => void;
  onTechnical: (level: TechnicalLevel | null) => void;
}) {
  const { t } = useLingui();
  const suggestion = suggestPhysicalLevel({ ...draft, descentM });
  const constant = suggestion ? suggestion.constant.toFixed(1) : "";
  const level = suggestion?.level ?? 0;

  const technicalHints: Record<TechnicalLevel, string> = {
    A: t`整備された道で、迷いにくく、転んでも大きな事故になりにくい。`,
    B: t`急な登り下りや、わかりにくい所がある。はしごやくさりが出ることもある。`,
    C: t`転落・滑落の危険がある所がある。地図を読む力と、ミスをしない注意が必要。`,
    D: t`岩場やガレ場、手を使う急な登り下りがある。道がわかりにくい所も多い。`,
    E: t`厳しい岩場や藪こぎが続く。道を自分で見つける技術と、高い判断力が必要。`,
  };

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t`体力度（1〜10）`}
        htmlFor="route-physical"
        hint={
          suggestion
            ? t`目安：コース定数 ${constant} → 体力度 ${level}。数字から計算した目安です。保存されるのは、ここで選んだ値です。`
            : t`距離と時間を入れると、目安が出ます。`
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="route-physical"
            value={draft.physicalLevel ?? ""}
            onChange={(e) => onPhysical(e.target.value === "" ? null : Number(e.target.value))}
            className={`${inputClass} max-w-48`}
          >
            <option value="">{t`選ばない`}</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {suggestion && suggestion.level !== draft.physicalLevel ? (
            <button type="button" onClick={() => onPhysical(suggestion.level)} className="tap-target rounded-xl border-2 border-line px-5 text-lg font-bold">
              {t`目安の値を入れる`}
            </button>
          ) : null}
        </div>
      </Field>

      <Field
        label={t`技術度（A〜E）`}
        htmlFor="route-technical"
        hint={draft.technicalLevel ? technicalHints[draft.technicalLevel] : t`道の状態から、手で選びます。`}
      >
        <select
          id="route-technical"
          value={draft.technicalLevel ?? ""}
          onChange={(e) => onTechnical(isTechnicalLevel(e.target.value) ? e.target.value : null)}
          className={`${inputClass} max-w-48`}
        >
          <option value="">{t`選ばない`}</option>
          {TECHNICAL_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

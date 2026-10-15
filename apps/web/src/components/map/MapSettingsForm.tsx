"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  baseLayers,
  darkTreatments,
  mapSettingsCookieString,
  mapSettingsResetCookieString,
  terrainLayers,
  defaultMapSettings,
  type MapSettings,
} from "@/lib/map-settings";
import type { Position } from "@/lib/map";
import { TrailMapLoader } from "./TrailMapLoader";
import type { MapStop } from "./TrailMap";

const choiceClass = (on: boolean) =>
  `tap-target inline-flex items-center justify-center rounded-lg border-2 border-ink px-3 text-base font-bold ${
    on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"
  }`;

/** Pick the map style; the preview below uses the unsaved choice, "Save" writes the cookie every map reads. */
export function MapSettingsForm({ initial, stops, line }: { initial: MapSettings; stops: MapStop[]; line: Position[] | null }) {
  const { t } = useLingui();
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<MapSettings>) => {
    setSaved(false);
    setS((cur) => ({ ...cur, ...patch }));
  };
  const secure = () => window.location.protocol === "https:";

  const baseNames = { std: t`標準`, pale: t`淡色` };
  const terrainNames = { hillshade: t`陰影（やわらかい影）`, relief: t`色別標高図（緑〜茶）` };
  const darkNames = { none: t`そのまま`, dim: t`少し暗く`, invert: t`色を反転` };

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-bold">{t`ベースマップ`}</legend>
        <div className="flex flex-wrap gap-2">
          {baseLayers.map((v) => (
            <button key={v} type="button" aria-pressed={s.base === v} onClick={() => set({ base: v })} className={choiceClass(s.base === v)}>
              {baseNames[v]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-bold">{t`地形ボタンで重ねるもの`}</legend>
        <div className="flex flex-wrap gap-2">
          {terrainLayers.map((v) => (
            <button key={v} type="button" aria-pressed={s.terrain === v} onClick={() => set({ terrain: v })} className={choiceClass(s.terrain === v)}>
              {terrainNames[v]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-base">
          {t`濃さ`} {Math.round(s.terrainOpacity * 100)}%
          <input
            type="range"
            min={0.2}
            max={0.8}
            step={0.05}
            value={s.terrainOpacity}
            onChange={(e) => set({ terrainOpacity: Number(e.target.value) })}
            className="h-10 flex-1"
          />
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-bold">{t`ダークモードの地図`}</legend>
        <div className="flex flex-wrap gap-2">
          {darkTreatments.map((v) => (
            <button key={v} type="button" aria-pressed={s.dark === v} onClick={() => set({ dark: v })} className={choiceClass(s.dark === v)}>
              {darkNames[v]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={choiceClass(true)}
          onClick={() => {
            document.cookie = mapSettingsCookieString(s, secure());
            setSaved(true);
          }}
        >
          {t`保存`}
        </button>
        <button
          type="button"
          className={choiceClass(false)}
          onClick={() => {
            document.cookie = mapSettingsResetCookieString(secure());
            setS(defaultMapSettings);
            setSaved(true);
          }}
        >
          {t`初期値に戻す`}
        </button>
        {saved ? <span role="status" className="text-base font-bold">{t`保存しました`}</span> : null}
      </div>

      <TrailMapLoader stops={stops} line={line} draft settings={s} />
    </div>
  );
}

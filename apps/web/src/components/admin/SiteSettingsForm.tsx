"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode } from "@/lib/api-error";
import { baseLayers, defaultMapSettings, terrainLayers, type BaseLayer, type MapSettings, type TerrainLayer } from "@/lib/map-settings";
import type { Entry } from "@/lib/gsi-large-style";
import { LargeStyleUpload } from "./LargeStyleUpload";
import { MapStylePreview } from "./MapStylePreview";

type Notice = { kind: "saved" | "error"; text: string } | null;

const choice = (on: boolean) =>
  `tap-target flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left ${on ? "border-ink bg-paper ring-2 ring-ink" : "border-line bg-paper hover:bg-surface"}`;

/**
 * 管理 > サイト全体の設定. What is chosen here is what every visitor sees, at once: the screen says so at the top and asks
 * again before saving. The first setting is the look of the map (the base map, the terrain shading, and how calm the
 * colours are); the preview map follows the choices before anything is saved.
 */
export function SiteSettingsForm({ initial }: { initial: MapSettings }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // A file chosen for the large-text map but not applied yet; the preview shows it.
  const [draft, setDraft] = useState<Entry[] | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = (patch: Partial<MapSettings>) => {
    setNotice(null);
    setS((cur) => ({ ...cur, ...patch }));
  };

  const baseNames: Record<BaseLayer, { name: string; hint: string }> = {
    std: { name: t`標準`, hint: t`道や建物、記号が細かく描かれた、いちばん詳しい地図です。` },
    pale: { name: t`淡色`, hint: t`色がおだやかで、道と名前が見やすい地図です。` },
    blank: { name: t`白地図`, hint: t`海岸線と境目だけの、いちばん静かな地図です。` },
    photo: { name: t`写真`, hint: t`空から撮った写真の地図です。` },
    large: { name: t`大きい文字`, hint: t`地名や記号が大きく、はっきり読める地図です。色の濃さとコントラストの調整は効きません。電波がないときは、名前が出ないことがあります。` },
  };
  const terrainNames: Record<TerrainLayer, string> = { hillshade: t`陰影（やわらかい影）`, relief: t`色別標高図（緑〜茶）` };

  async function save() {
    if (!window.confirm(t`この設定は、本番のサイトにすぐ反映されます。すべての訪問者の地図の見た目が変わります。保存しますか？`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/admin/settings/map-style", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ base: s.base, terrain: s.terrain, terrainOpacity: s.terrainOpacity, saturation: s.saturation, contrast: s.contrast, labelScale: s.labelScale, iconScale: s.iconScale, lineScale: s.lineScale }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
      if (res.ok && json?.ok === true) {
        setSaved(s);
        setNotice({ kind: "saved", text: t`保存しました。サイトの地図に反映されています。` });
      } else {
        setNotice({ kind: "error", text: messages[json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json)] });
      }
    } catch {
      setNotice({ kind: "error", text: messages.network });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <p role="note" className="rounded-2xl border-2 border-caution bg-paper p-4 text-lg font-bold leading-snug">
        {t`ここは、本番のサイト全体の設定です。保存すると、すぐにすべての訪問者の画面が変わります。内容をよく確かめてから保存してください。`}
      </p>

      <section aria-labelledby="map-style" className="flex flex-col gap-5 rounded-3xl bg-surface p-5">
        <h2 id="map-style" className="text-2xl font-bold">
          {t`地図の見た目`}
        </h2>
        <p className="text-lg">{t`訪問者が見る地図（マップ画面、ルートのページ）の見た目です。地図を作る管理画面の地図は、見やすさのため、いつも「標準」です。`}</p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-bold">{t`ベースの地図`}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {baseLayers.map((v) => (
              <button key={v} type="button" aria-pressed={s.base === v} onClick={() => set({ base: v })} className={choice(s.base === v)}>
                <span className="text-xl font-bold">{baseNames[v].name}</span>
                <span className="text-base text-muted">{baseNames[v].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-bold">{t`「地形」ボタンで重ねるもの`}</legend>
          <div className="flex flex-wrap gap-2">
            {terrainLayers.map((v) => (
              <button key={v} type="button" aria-pressed={s.terrain === v} onClick={() => set({ terrain: v })} className={`${choice(s.terrain === v)} py-2`}>
                <span className="text-lg font-bold">{terrainNames[v]}</span>
              </button>
            ))}
          </div>
          <Slider label={t`地形の濃さ`} value={s.terrainOpacity} min={0.2} max={0.8} step={0.05} shown={`${Math.round(s.terrainOpacity * 100)}%`} onChange={(v) => set({ terrainOpacity: v })} />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-bold">{t`地図を見やすくする`}</legend>
          <Slider label={t`色の濃さ`} value={s.saturation} min={-1} max={0.5} step={0.05} shown={`${Math.round((1 + s.saturation) * 100)}%`} onChange={(v) => set({ saturation: v })} />
          <Slider label={t`コントラスト`} value={s.contrast} min={-0.5} max={0.5} step={0.05} shown={s.contrast === 0 ? t`そのまま` : `${s.contrast > 0 ? "+" : ""}${Math.round(s.contrast * 100)}`} onChange={(v) => set({ contrast: v })} />
          <p className="text-base text-muted">{t`色を薄くすると、道すじや印が目立ちます。濃さ100%、コントラスト「そのまま」が、国土地理院の地図のままです。`}</p>
        </fieldset>

        {s.base === "large" ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-lg font-bold">{t`「大きい文字」の大きさ`}</legend>
            <Slider label={t`地名の大きさ`} value={s.labelScale} min={0.8} max={2} step={0.1} shown={`${Math.round(s.labelScale * 100)}%`} onChange={(v) => set({ labelScale: v })} />
            <Slider label={t`記号の大きさ`} value={s.iconScale} min={0.8} max={2} step={0.1} shown={`${Math.round(s.iconScale * 100)}%`} onChange={(v) => set({ iconScale: v })} />
            <Slider label={t`線の太さ`} value={s.lineScale} min={0.8} max={2} step={0.1} shown={`${Math.round(s.lineScale * 100)}%`} onChange={(v) => set({ lineScale: v })} />
            <p className="text-base text-muted">{t`100%が、国土地理院の地図に自分たちの調整を重ねた大きさです。大きくしすぎると文字が重なって読めなくなります。下の見本で確かめてください。`}</p>
          </fieldset>
        ) : null}
        {s.base === "large" ? <LargeStyleUpload draft={draft} onDraft={setDraft} /> : null}

        <MapStylePreview settings={s} entries={draft} />

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !dirty} onClick={save} className="tap-target rounded-xl bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
            {busy ? t`保存しています…` : t`保存する`}
          </button>
          <button type="button" disabled={busy} onClick={() => set(defaultMapSettings)} className="tap-target rounded-xl border-2 border-line px-6 text-lg font-bold disabled:opacity-50">
            {t`初期値にする`}
          </button>
          {dirty ? <span className="text-base text-muted">{t`まだ保存していません。`}</span> : null}
        </div>
        {notice ? (
          <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-paper p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
            {notice.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Slider({ label, value, min, max, step, shown, onChange }: { label: string; value: number; min: number; max: number; step: number; shown: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-lg">
      <span className="w-40 font-bold">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-10 min-w-48 flex-1" />
      <span className="w-20 tabular-nums">{shown}</span>
    </label>
  );
}

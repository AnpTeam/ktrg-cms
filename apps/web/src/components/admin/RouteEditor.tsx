"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { checklist, factsFromDraft, progress, type EditorTab } from "@/lib/admin/checklist";
import { fillElevations } from "@/lib/admin/dem";
import type { LngLatEle } from "@/lib/admin/line";
import { loadDemTile } from "@/lib/admin/dem-client";
import {
  draftFromServer,
  draftReducer,
  initialState,
  isDirty,
  placeFromServer,
  type PlaceDraft,
  type TextField,
  type RouteDraft,
} from "@/lib/admin/route-draft";
import { draftProblems, placeChanged, planSave, type DraftProblem } from "@/lib/admin/save-plan";
import type { Prefecture } from "@/lib/admin/types";
import { formatUpdated } from "@/lib/format";
import { Check, Field, inputClass, MultilingualField, NumberInput, Section, TextInput } from "./fields";
import { LivePreview } from "./LivePreview";
import { MapEditorLoader } from "./map-editor/MapEditorLoader";
import type { ElevationStatus } from "./map-editor/MapEditor";
import { isListedMunicipality } from "@/lib/municipalities";
import { stampableByDefault } from "@/lib/point-kinds";
import { MunicipalityField } from "./MunicipalityField";
import { PhotoSlot } from "./PhotoSlot";
import { PlacePanel } from "./PlacePanel";
import { PlaceTable } from "./PlaceTable";
import { useChecklistLabels } from "./useChecklistLabels";

const TABS: EditorTab[] = ["overview", "text", "map", "places", "check"];
const isTab = (v: string | null): v is EditorTab => v !== null && (TABS as string[]).includes(v);

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** A short fingerprint of where a line's points are (not their heights), to tell whether it has changed. */
const lineSignature = (line: RouteDraft["line"]) => `${line.length}:${line.reduce((s, p, i) => s + (p[0] * 31 + p[1] * 17) * ((i % 7) + 1), 0).toFixed(6)}`;

export function RouteEditor({ initial, order, locale }: { initial: RouteDraft; order: number; locale: string }) {
  const { t } = useLingui();
  const router = useRouter();
  const messages = useErrorMessages();
  const [state, dispatch] = useReducer(draftReducer, initial, initialState);
  const draft = state.present;
  const [saved, setSaved] = useState<RouteDraft>(initial);
  const savedRef = useRef<RouteDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [problems, setProblems] = useState<DraftProblem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  // The places tab: a table to type many at once (where a new route starts), or the detailed panel per place.
  const [placesView, setPlacesView] = useState<"table" | "detail">(() => (initial.id === null ? "table" : "detail"));
  const params = useSearchParams();
  const [section, setSectionState] = useState<EditorTab>(() => {
    const q = params.get("tab");
    return isTab(q) ? q : "overview";
  });
  const labels = useChecklistLabels();
  const setSection = (next: EditorTab) => {
    setSectionState(next);
    setView("edit");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
  const [elevation, setElevation] = useState<ElevationStatus>("idle");
  const attempted = useRef<string | null>(null);

  const dirty = isDirty(draft, saved);
  const isNew = draft.id === null;

  const setSavedCopy = (next: RouteDraft) => {
    savedRef.current = next;
    setSaved(next);
  };

  // ---- leaving with unsaved work ---------------------------------------------------------------------------
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---- undo and redo from the keyboard (not while typing in a box: the box has its own) -----------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || isTyping(e.target)) return;
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- heights for a drawn line, from the elevation tiles ---------------------------------------------------------
  const needsHeights = draft.line.length >= 2 && !draft.line.every((p) => typeof p[2] === "number");
  useEffect(() => {
    if (!needsHeights) return;
    const signature = lineSignature(draft.line);
    if (attempted.current === signature) return; // already tried this exact line (tiles may be missing)
    let cancelled = false;
    const timer = setTimeout(async () => {
      setElevation("loading");
      const filled = await fillElevations(draft.line, loadDemTile);
      if (cancelled) return;
      attempted.current = signature;
      setElevation(filled.missing > 0 ? "partial" : "idle");
      dispatch({ type: "elevations", points: filled.points });
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.line, needsHeights]);

  const heightsState: ElevationStatus = needsHeights ? elevation : "idle";

  // ---- saving ---------------------------------------------------------------------------------------------
  async function save() {
    if (saving || !dirty) return;
    const found = draftProblems(draft);
    setProblems(found);
    if (found.length > 0) {
      const first = found[0]!.kind;
      setSection(first.startsWith("place_") ? "places" : "overview"); // show the tab that holds the red item
      setMessage({ kind: "error", text: t`保存できません。赤く示した項目を直してください。` });
      return;
    }
    setSaving(true);
    setMessage(null);
    const snapshot = draft;
    let routeId = snapshot.id;
    let routeUpdatedAt = snapshot.updatedAt;
    let base = savedRef.current;
    const ids = new Map(snapshot.places.map((p) => [p.key, p.id]));
    const steps = planSave(snapshot, snapshot.id === null ? null : base);
    let failure: string | null = null;

    for (const step of steps) {
      if (step.op === "deleteSpot") {
        const res = await outcome(api.admin.spots({ id: step.id }).delete());
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        base = { ...base, places: base.places.filter((p) => p.key !== step.key) };
        setSavedCopy(base);
      } else if (step.op === "createRoute") {
        const res = await outcome(api.admin.routes.post(step.body));
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        routeId = res.data.route.id;
        routeUpdatedAt = res.data.route.updatedAt;
        dispatch({ type: "savedRoute", id: routeId, updatedAt: routeUpdatedAt });
        base = { ...snapshot, id: routeId, updatedAt: routeUpdatedAt, places: [] };
        setSavedCopy(base);
      } else if (step.op === "updateRoute") {
        const res = await outcome(api.admin.routes({ id: routeId! }).patch({ updatedAt: routeUpdatedAt!, ...step.body }));
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        routeUpdatedAt = res.data.route.updatedAt;
        dispatch({ type: "savedRoute", id: routeId!, updatedAt: routeUpdatedAt });
        base = { ...snapshot, id: routeId, updatedAt: routeUpdatedAt, places: base.places };
        setSavedCopy(base);
      } else if (step.op === "createSpot") {
        const res = await outcome(api.admin.routes({ id: routeId! }).spots.post(step.body));
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        const place: PlaceDraft = { ...placeFromServer(res.data.spot), key: step.key };
        ids.set(step.key, place.id);
        dispatch({ type: "savedPlace", key: step.key, place });
        base = { ...base, places: [...base.places, place] };
        setSavedCopy(base);
      } else if (step.op === "updateSpot") {
        const current = snapshot.places.find((p) => p.key === step.key)!;
        const res = await outcome(api.admin.spots({ id: step.id }).patch({ updatedAt: current.updatedAt!, ...step.body }));
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        const place: PlaceDraft = { ...placeFromServer(res.data.spot), key: step.key };
        dispatch({ type: "savedPlace", key: step.key, place });
        base = { ...base, places: base.places.map((p) => (p.key === step.key ? place : p)) };
        setSavedCopy(base);
      } else if (step.op === "orderSpots") {
        const order = step.keys.map((k) => ids.get(k)!);
        const res = await outcome(api.admin.routes({ id: routeId! }).spots.order.put({ ids: order }));
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        const byKey = new Map(base.places.map((p) => [p.key, p]));
        base = { ...base, places: step.keys.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : [])) };
        setSavedCopy(base);
      }
    }

    if (failure) {
      setMessage({ kind: "error", text: failure });
      setSaving(false);
      return;
    }

    // Take over what the server now holds, so the screen shows the truth (and the next save has fresh times).
    const fresh = await outcome(api.admin.routes({ id: routeId! }).get());
    if (fresh.ok) {
      const next = draftFromServer(fresh.data.route, fresh.data.spots);
      const index = snapshot.places.findIndex((p) => p.key === selectedKey);
      dispatch({ type: "loaded", draft: next });
      setSavedCopy(next);
      setSelectedKey(index >= 0 ? (next.places[index]?.key ?? null) : null);
      attempted.current = null;
    }
    setMessage({ kind: "ok", text: t`保存しました。` });
    setProblems([]);
    setSaving(false);
    if (snapshot.id === null) router.replace(`/admin/routes/${routeId}`);
  }

  async function setPublished(key: string, publish: boolean) {
    const place = draft.places.find((p) => p.key === key);
    if (!place?.id || busyKey) return;
    setBusyKey(key);
    setMessage(null);
    const call = publish ? api.admin.spots({ id: place.id }).publish.post() : api.admin.spots({ id: place.id }).unpublish.post();
    const res = await outcome(call);
    if (res.ok) {
      const next: PlaceDraft = { ...placeFromServer(res.data.spot), key };
      dispatch({ type: "savedPlace", key, place: next });
      setSavedCopy({ ...savedRef.current, places: savedRef.current.places.map((p) => (p.key === key ? next : p)) });
      setMessage({ kind: "ok", text: publish ? t`公開しました。` : t`公開をやめました。` });
    } else setMessage({ kind: "error", text: messages[res.key] });
    setBusyKey(null);
  }

  async function deleteRoute() {
    if (!draft.id || saving) return;
    if (!window.confirm(t`このルートを削除します。元に戻せません。よろしいですか？`)) return;
    const res = await outcome(api.admin.routes({ id: draft.id }).delete());
    if (res.ok) router.replace(`/admin/routes`);
    else setMessage({ kind: "error", text: messages[res.key] });
  }

  // ---- what the form needs -------------------------------------------------------------------------------
  const savedByKey = useMemo(() => new Map(saved.places.map((p) => [p.key, p])), [saved.places]);
  const problemOf = (kind: DraftProblem["kind"], key?: string) => problems.some((p) => p.kind === kind && (!("key" in p) || p.key === key));
  const prefName: Record<Prefecture, string> = { osaka: t`大阪府`, wakayama: t`和歌山県`, nara: t`奈良県` };
  // The numbers on the map are the stamp numbers visitors see; a waypoint without a stamp has none.
  const editorPlaces = (() => {
    let stamp = 0;
    return draft.places.map((p) => ({ key: p.key, lat: p.lat, lng: p.lng, number: p.stampable ? ++stamp : null, name: p.nameJa, stampable: p.stampable, stopBy: p.stopBy, kind: p.kind }));
  })();
  const text = (field: TextField) => (value: string) => dispatch({ type: "text", field, value });
  const checks = useMemo(() => checklist(factsFromDraft(draft)), [draft]);
  const missingRequired = progress(checks).requiredTotal - progress(checks).requiredDone;

  return (
    <div className={`flex flex-col gap-5 ${saving ? "[&_fieldset]:pointer-events-none" : ""}`} aria-busy={saving}>
      {/* Title bar: always in reach, with the one button that matters. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 lg:-mx-8 lg:px-8">
        <h1 className="min-w-0 flex-1 break-words text-2xl font-bold">{isNew ? t`新しいルート` : draft.nameJa || t`（名前がありません）`}</h1>
        <p className="text-base text-muted" aria-live="polite">
          {dirty ? t`保存していない変更があります` : isNew ? "" : t`保存済み（更新 ${formatUpdated(locale, draft.updatedAt ?? new Date().toISOString())}）`}
        </p>
        <button type="button" disabled={!dirty || saving} onClick={save} className="tap-target rounded-xl bg-ink px-8 text-xl font-bold text-paper disabled:opacity-40">
          {saving ? t`保存中…` : t`保存する`}
        </button>
      </div>

      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-surface p-4 text-lg font-bold ${message.kind === "error" ? "text-danger" : "text-moss"}`}>
          {message.text}
        </p>
      ) : null}

      {/* Narrow screens: one thing at a time. */}
      <div className="flex gap-2 lg:hidden" role="tablist" aria-label={t`表示の切り替え`}>
        {(["edit", "preview"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`tap-target flex-1 rounded-xl border-2 text-lg font-bold ${view === id ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {id === "edit" ? t`入力` : t`見え方`}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_27rem]">
        <div className={`flex min-w-0 flex-col gap-5 ${view === "edit" ? "" : "hidden lg:flex"}`}>
          <nav aria-label={t`編集する内容`} className="flex flex-wrap gap-2" role="tablist">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={section === id}
                aria-controls="editor-panel"
                onClick={() => setSection(id)}
                className={`tap-target rounded-xl border-2 px-4 text-lg font-bold ${section === id ? "border-ink bg-ink text-paper" : "border-line"}`}
              >
                {labels.tab[id]}
                {id === "check" && missingRequired > 0 ? <span className="ml-2 rounded-full bg-danger px-2 text-base text-white">{missingRequired}</span> : null}
              </button>
            ))}
          </nav>

          <div id="editor-panel" role="tabpanel" aria-labelledby={`tab-${section}`} className="flex flex-col gap-5">
            {section === "overview" ? (
              <>
                <Section title={t`基本`}>
                  <MultilingualField id="route-name" field="name" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`ルートの名前`} ja={draft.nameJa} en={draft.nameEn} onJa={text("nameJa")} onEn={text("nameEn")} required invalid={problemOf("route_name")} />
                  {problemOf("route_name") ? <p role="alert" className="text-base font-bold text-danger">{t`日本語の名前を入れてください。`}</p> : null}
                  <div className="flex flex-wrap gap-4">
                    <Field label={t`都道府県`} htmlFor="route-pref">
                      <select id="route-pref" value={draft.prefecture ?? ""} onChange={(e) => {
                          const next = (e.target.value || null) as Prefecture | null;
                          // A city of the old prefecture does not belong to the new one: start the city again.
                          if (isListedMunicipality(draft.prefecture, draft.municipality) && !isListedMunicipality(next, draft.municipality)) text("municipality")("");
                          dispatch({ type: "prefecture", value: next });
                        }} className={`${inputClass} min-w-48`}>
                        <option value="">{t`未選択`}</option>
                        {(["wakayama", "osaka", "nara"] as const).map((p) => (
                          <option key={p} value={p}>
                            {prefName[p]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <MunicipalityField id="route-muni" prefecture={draft.prefecture} value={draft.municipality} onChange={text("municipality")} />
                  </div>
                </Section>

                <Section title={t`数字`}>
                  <div className="flex flex-wrap gap-6">
                    <Field label={t`距離`} htmlFor="route-distance" hint={draft.distanceManual ? t`手で入れた数字です。空にすると、線から計算します。` : t`線の長さから、自動で計算しています。`}>
                      <NumberInput id="route-distance" value={draft.distanceKm} min={0} max={2000} suffix="km" onChange={(v) => dispatch({ type: "distance", value: v })} />
                    </Field>
                    <Field label={t`登り（獲得標高）`} htmlFor="route-climb" hint={draft.climbManual ? t`手で入れた数字です。空にすると、標高から計算します。` : t`線の標高から、自動で計算します。`}>
                      <NumberInput id="route-climb" value={draft.elevationGainM} min={0} max={10000} integer suffix="m" onChange={(v) => dispatch({ type: "climb", value: v })} />
                    </Field>
                    <Field label={t`歩く時間`} htmlFor="route-time" hint={draft.timeManual ? t`手で入れた数字です。空にすると、距離と登りから計算します。` : t`距離と登りから、目安を自動で計算しています。`}>
                      <NumberInput id="route-time" value={draft.expectedTimeMin} min={0} max={20000} integer suffix={t`分`} onChange={(v) => dispatch({ type: "time", value: v })} />
                    </Field>
                  </div>
                  <Field label={t`むずかしさ`} htmlFor="route-difficulty" hint={t`入れた文字が、そのまま表示されます。`}>
                    <TextInput id="route-difficulty" value={draft.difficulty} onChange={text("difficulty")} maxLength={100} />
                  </Field>
                </Section>

                <Section title={t`写真と動画`}>
                  <Field label={t`ルートの写真のリンク`} htmlFor="route-photo" hint={t`https:// で始まるリンクを入れます。空にすると、写真は表示されません。`}>
                    <TextInput id="route-photo" value={draft.photoUrl} onChange={text("photoUrl")} maxLength={500} invalid={problemOf("photo_link")} />
                  </Field>
                  {problemOf("photo_link") ? <p role="alert" className="text-base font-bold text-danger">{t`写真のリンクは、https:// で始まるものだけ使えます。`}</p> : null}
                  <PhotoSlot url={draft.photoUrl} className="max-w-md" />
                  <Field label={t`動画のリンク（YouTube か Vimeo）`} htmlFor="route-video" hint={t`https:// で始まるリンクを入れます。空にすると、動画は表示されません。`}>
                    <TextInput id="route-video" value={draft.videoUrl} onChange={text("videoUrl")} maxLength={500} invalid={problemOf("video_link")} />
                  </Field>
                  {problemOf("video_link") ? <p role="alert" className="text-base font-bold text-danger">{t`YouTube か Vimeo の、https:// で始まるリンクにしてください。`}</p> : null}
                </Section>
              </>
            ) : null}

            {section === "text" ? (
              <>
                <Section title={t`ルートの説明`}>
                  <MultilingualField id="route-desc" field="description" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`ルートの説明`} ja={draft.descriptionJa} en={draft.descriptionEn} onJa={text("descriptionJa")} onEn={text("descriptionEn")} multiline />
                  <p className="text-base text-muted">{t`改行は、そのまま表示されます。`}</p>
                </Section>
                <Section title={t`歴史・由来`}>
                  <MultilingualField id="route-history" field="history" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`歴史・由来`} ja={draft.historyJa} en={draft.historyEn} onJa={text("historyJa")} onEn={text("historyEn")} multiline />
                </Section>
                <Section title={t`アクセス・交通`}>
                  <MultilingualField id="route-access" field="access" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`アクセス・交通`} ja={draft.accessJa} en={draft.accessEn} onJa={text("accessJa")} onEn={text("accessEn")} multiline />
                  <p className="text-base text-muted">{t`最寄りの駅やバス停、スタート地点とゴール地点への行き方を書きます。`}</p>
                </Section>
              </>
            ) : null}

            {section === "map" ? (
              <Section title={t`地図と線`} id="map-section">
                <MapEditorLoader
                  line={draft.line}
                  places={editorPlaces}
                  selectedKey={selectedKey}
                  distanceKm={draft.distanceKm}
                  climbM={draft.elevationGainM}
                  elevationStatus={heightsState}
                  canUndo={state.past.length > 0}
                  canRedo={state.future.length > 0}
                  onUndo={() => dispatch({ type: "undo" })}
                  onRedo={() => dispatch({ type: "redo" })}
                  onLine={(points) => dispatch({ type: "line", points })}
                  onAddPlace={(lat, lng) => {
                    const key = crypto.randomUUID();
                    dispatch({ type: "addPlace", key, lat, lng });
                    setSelectedKey(key);
                  }}
                  onAddPlaces={(list) => dispatch({ type: "addPlaces", places: list })}
                  onMovePlace={(key, lat, lng) => dispatch({ type: "movePlace", key, lat, lng })}
                  onRemovePlace={(key) => {
                    const p = draft.places.find((x) => x.key === key);
                    if (p?.published) setMessage({ kind: "error", text: t`公開中の経由地は消せません。先に「公開をやめる」を押してください。` });
                    else dispatch({ type: "removePlace", key });
                  }}
                  onSelectPlace={setSelectedKey}
                  onPatchPlace={(key, patch) => {
                    const p = draft.places.find((x) => x.key === key);
                    // A new waypoint's stamp switch follows its kind; a saved one keeps what was chosen for it.
                    if (p) dispatch({ type: "place", key, patch: patch.kind && p.id === null ? { ...patch, stampable: stampableByDefault(patch.kind) } : patch });
                  }}
                  onSnap={async (points) => {
                    const res = await outcome(api.admin["route-snap"].post({ points }));
                    return res.ok ? { ok: true, line: res.data.line as LngLatEle[] } : { ok: false, message: messages[res.key] };
                  }}
                />

                <fieldset className="flex flex-col gap-3 rounded-xl bg-paper p-4">
                  <legend className="px-1 text-base font-bold">{t`線の確認`}</legend>
                  <p className="text-base text-muted">{t`確認していない線は、利用者には表示されません。公式の地図などと見比べてから、チェックを入れてください。`}</p>
                  <Check id="route-line-verified" checked={draft.lineVerified} disabled={draft.line.length < 2} onChange={(v) => dispatch({ type: "lineVerified", value: v })}>
                    {t`線を確認した`}
                  </Check>
                  <Field label={t`確認した情報源（サイト名やリンク）`} htmlFor="route-line-source">
                    <TextInput id="route-line-source" value={draft.lineSource} onChange={text("lineSource")} maxLength={500} />
                  </Field>
                </fieldset>
              </Section>
            ) : null}

            {section === "places" ? (
              <Section title={t`経由地（${draft.places.length}か所）`}>
                <div role="group" aria-label={t`場所の見せ方`} className="flex flex-wrap gap-2">
                  {(["table", "detail"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={placesView === v}
                      onClick={() => setPlacesView(v)}
                      className={`tap-target rounded-xl border-2 px-5 text-lg font-bold ${placesView === v ? "border-ink bg-ink text-paper" : "border-line"}`}
                    >
                      {v === "table" ? t`表でまとめて入力` : t`1か所ずつ詳しく`}
                    </button>
                  ))}
                </div>
                {placesView === "table" ? (
                  <PlaceTable
                    places={draft.places}
                    busy={busyKey !== null || saving}
                    invalidName={(key) => problemOf("place_name", key)}
                    onChange={(key, patch) => dispatch({ type: "place", key, patch })}
                    onRemove={(key) => dispatch({ type: "removePlace", key })}
                    onAdd={() => dispatch({ type: "addRow", key: crypto.randomUUID() })}
                  />
                ) : draft.places.length === 0 ? (
                  <p className="rounded-xl bg-paper p-4 text-lg">
                    {t`まだありません。`}{" "}
                    <button type="button" onClick={() => setSection("map")} className="font-bold text-accent underline underline-offset-4">
                      {t`「地図と線」で経由地を置く`}
                    </button>
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {draft.places.map((p, i) => (
                      <PlacePanel
                        key={p.key}
                        place={p}
                        number={i + 1}
                        selected={p.key === selectedKey}
                        dirty={placeChanged(p, savedByKey.get(p.key))}
                        busy={busyKey !== null || saving}
                        canMoveUp={i > 0}
                        canMoveDown={i < draft.places.length - 1}
                        invalidName={problemOf("place_name", p.key)}
                        invalidPhoto={problemOf("place_photo_link", p.key)}
                        onSelect={() => setSelectedKey(p.key === selectedKey ? null : p.key)}
                        onChange={(patch) => dispatch({ type: "place", key: p.key, patch })}
                        onRemove={() => {
                          dispatch({ type: "removePlace", key: p.key });
                          setSelectedKey(null);
                        }}
                        onMove={(step) => {
                          const keys = draft.places.map((x) => x.key);
                          const j = i + step;
                          [keys[i], keys[j]] = [keys[j]!, keys[i]!];
                          dispatch({ type: "reorderPlaces", keys });
                        }}
                        onPublish={() => setPublished(p.key, true)}
                        onUnpublish={() => setPublished(p.key, false)}
                      />
                    ))}
                  </ol>
                )}
                {problems.some((p) => p.kind === "place_position") ? <p role="alert" className="text-base font-bold text-danger">{t`緯度と経度は、両方入れるか、両方空にしてください。`}</p> : null}
              </Section>
            ) : null}

            {section === "check" ? (
              <Section title={t`公開前のチェック`}>
                <p className="text-base text-muted">{t`保存していない内容も含めて調べています。`}</p>
                {(
                  [
                    [true, t`必要なこと`],
                    [false, t`あると、もっとよいこと`],
                  ] as const
                ).map(([required, title]) => (
                  <div key={String(required)} className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <ul className="flex flex-col gap-2">
                      {checks
                        .filter((i) => i.required === required)
                        .map((i) => (
                          <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-paper p-3">
                            <span className={`w-20 shrink-0 rounded-lg px-3 py-1 text-center text-base font-bold ${i.done ? "bg-moss text-paper" : required ? "bg-danger text-white" : "bg-surface"}`}>{i.done ? t`できた` : t`まだ`}</span>
                            <span className="min-w-0 flex-1 text-lg">{labels.item[i.id]}</span>
                            {!i.done ? (
                              <button type="button" onClick={() => setSection(i.tab)} className="tap-target rounded-xl border border-ink px-4 text-base font-bold">
                                {t`${labels.tab[i.tab]}を開く`}
                              </button>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </Section>
            ) : null}
          </div>

          {!isNew ? (
            <div className="flex flex-col gap-2 pb-10">
              <button type="button" onClick={deleteRoute} disabled={draft.places.length > 0 || saving} className="tap-target w-fit rounded-xl border-2 border-danger px-5 text-lg font-bold text-danger disabled:opacity-40">
                {t`このルートを削除`}
              </button>
              {draft.places.length > 0 ? <p className="text-base text-muted">{t`経由地が残っているルートは削除できません。`}</p> : null}
            </div>
          ) : null}
        </div>

        <div className={`min-w-0 ${view === "preview" ? "" : "hidden lg:block"}`}>
          <div className="lg:sticky lg:top-24">
            <LivePreview draft={draft} order={order} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}

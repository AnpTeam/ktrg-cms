"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { useErrorMessages } from "@/components/useErrorMessages";
import { CheckIcon, DocumentIcon, ListIcon, MapIcon, PinIcon } from "@/components/icons";
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
  walkedStats,
  placeFromServer,
  type DraftAction,
  type PlaceDraft,
  type TextField,
  type RouteDraft,
} from "@/lib/admin/route-draft";
import { RubyEditor } from "./RubyEditor";
import type { StopRole } from "@/lib/route-stops";
import { backupKey, parseBackup, worthRestoring, writeBackup } from "@/lib/admin/draft-backup";
import { draftProblems, keepLaterEdits, placeChanged, planSave, restoreHeld, withLegIds, type DraftProblem } from "@/lib/admin/save-plan";
import type { AdminSharedSpot, Prefecture } from "@/lib/admin/types";
import { formatUpdated } from "@/lib/format";
import { Check, Field, inputClass, MultilingualField, NumberInput, Section, TextInput } from "./fields";
import { LivePreview } from "./LivePreview";
import { MapEditorLoader } from "./map-editor/MapEditorLoader";
import type { ElevationStatus } from "./map-editor/MapEditor";
import { isListedMunicipality } from "@/lib/municipalities";
import { stampableByDefault } from "@/lib/point-kinds";
import { walkStyleOf } from "@/lib/walk-style";
import { PublishedEditDialog, skipsPublishedWarning } from "./PublishedEditDialog";
import { AccessPointsEditor } from "./AccessPointsEditor";
import { GradingFields } from "./GradingFields";
import { MunicipalityField } from "./MunicipalityField";
import { PhotoLinkDetails } from "./PhotoLinkDetails";
import { PhotoSlot } from "./PhotoSlot";
import { PhotoUpload } from "./PhotoUpload";
import { RouteHistory } from "./RouteHistory";
import { NearbyPlacesManager } from "./DirectoryPicker";
import { SubtitleUpload } from "./SubtitleUpload";
import { VideoUpload } from "./VideoUpload";
import { VideoHistory } from "./VideoHistory";
import { parseVideoFile } from "@/lib/video";
import { PlacePanel } from "./PlacePanel";
import { PlaceTable } from "./PlaceTable";
import { SharedPlaces } from "./SharedPlaces";
import { useChecklistLabels } from "./useChecklistLabels";
import { confirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/lib/admin/toast";

const TABS: EditorTab[] = ["overview", "text", "map", "places", "check"];
const TAB_ICONS: Record<EditorTab, ReactNode> = { overview: <ListIcon />, text: <DocumentIcon />, map: <MapIcon />, places: <PinIcon />, check: <CheckIcon /> };
const isTab = (v: string | null): v is EditorTab => v !== null && (TABS as string[]).includes(v);

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** A short fingerprint of where a line's points are (not their heights), to tell whether it has changed. */
const lineSignature = (line: RouteDraft["line"]) => `${line.length}:${line.reduce((s, p, i) => s + (p[0] * 31 + p[1] * 17) * ((i % 7) + 1), 0).toFixed(6)}`;

export function RouteEditor({ initial, order, locale, shared = [], sharedWith = {}, routeNames = {}, back }: { back?: ReactNode; initial: RouteDraft; order: number; locale: string; shared?: AdminSharedSpot[]; sharedWith?: Record<string, string[]>; routeNames?: Record<string, string> }) {
  const { t } = useLingui();
  const router = useRouter();
  const messages = useErrorMessages();
  const [state, dispatch] = useReducer(draftReducer, initial, initialState);
  const draft = state.present;
  const [saved, setSaved] = useState<RouteDraft>(initial);
  const savedRef = useRef<RouteDraft>(initial);
  // The draft as it is now, for a save that has been running a while (see keepLaterEdits).
  const draftRef = useRef<RouteDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // An error with fields to fix offers a way to them.
  // A caller that has just found problems passes them: `problems` is only new on the next render.
  const setMessage = (m: { kind: "error" | "ok"; text: string } | null, now: DraftProblem[] = problems) =>
    showToast(m && (m.kind === "error" && now.length > 0 ? { ...m, action: { label: t`直す場所を見る`, run: () => showFirstProblem(now[0]!.kind) } } : m));
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
    window.history.replaceState(null, "", url.href); // a string: the service worker library forwards this value, and a URL object cannot be sent
  };
  const [elevation, setElevation] = useState<ElevationStatus>("idle");
  const attempted = useRef<string | null>(null);

  // Editing a published waypoint turns it back into a draft: ask once first (unless the person said not to).
  const [pendingEdit, setPendingEdit] = useState<{ key: string; action: DraftAction } | null>(null);
  function guarded(key: string, action: DraftAction) {
    const p = draft.places.find((x) => x.key === key);
    if (p?.published && p.id !== null && !skipsPublishedWarning()) setPendingEdit({ key, action });
    else dispatch(action);
  }

  // A good result fades on its own; an error stays until it is closed.

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const dirty = isDirty(draft, saved);
  const isNew = draft.id === null;

  const setSavedCopy = (next: RouteDraft) => {
    savedRef.current = next;
    setSaved(next);
  };

  // ---- a copy of unsaved work, kept in this browser -------------------------------------------------------------
  // The stored copy is read in the browser only (the server render has none), as text so the snapshot stays the same between renders.
  const storedCopy = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(backupKey(initial.id));
      } catch {
        return null;
      }
    },
    () => null,
  );
  const offered = useMemo(() => {
    const b = parseBackup(storedCopy);
    return worthRestoring(b, initial) ? b : null;
  }, [storedCopy, initial]);
  const [offerClosed, setOfferClosed] = useState(false);
  const offerOpen = offered !== null && !offerClosed;
  const offeredAt = offered ? formatUpdated(locale, offered.at) : "";
  useEffect(() => {
    if (offerOpen) return; // the old copy is not overwritten (or dropped) before the person has chosen
    const timer = setTimeout(() => writeBackup(localStorage, draft, savedRef.current.updatedAt, dirty), 1000);
    return () => clearTimeout(timer);
  }, [draft, dirty, offerOpen]);

  // ---- leaving with unsaved work ---------------------------------------------------------------------------
  useUnsavedGuard(dirty);

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
  /** Brings the first red field into view and puts the cursor there (after the tab that holds it has been drawn). */
  function showFirstProblem(kind: string) {
    setSection(kind.startsWith("place_") ? "places" : "overview");
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 120);
  }

  async function save() {
    if (saving || busyKey || !dirty) return;
    const found = draftProblems(draft);
    setProblems(found);
    // A problem with the route itself stops the save. An unfinished waypoint does not: it is held back (what was typed stays on
    // screen, in red) and everything else is saved, so one blank row never costs the rest of the work.
    const routeProblem = found.find((p) => !p.kind.startsWith("place_"));
    if (routeProblem) {
      setMessage({ kind: "error", text: t`保存できません。赤く示した項目を直してください。` }, found);
      showFirstProblem(routeProblem.kind); // the tab that holds the red item, and the item itself
      return;
    }
    const held = new Set(found.flatMap((p) => ("key" in p ? [p.key] : [])));
    const unsourced = draft.lineVerified && draft.lineSource.trim() === "";
    setOfferClosed(true); // saving settles the question of an old copy; the banner must not return for the copy this very edit made
    setSaving(true);
    setMessage(null);
    // What is sent: without the held waypoints (a saved one is sent as it was saved, a new one is left out).
    const snapshot: RouteDraft =
      held.size === 0
        ? draft
        : { ...draft, places: draft.places.flatMap((p) => (!held.has(p.key) ? [p] : savedRef.current.places.filter((s) => s.key === p.key))) };
    let routeId = snapshot.id;
    let routeUpdatedAt = snapshot.updatedAt;
    let base = savedRef.current;
    const ids = new Map(snapshot.places.map((p) => [p.key, p.id]));
    // After a waypoint is unpublished its update time changes: the changes are saved against the new one.
    const freshUpdatedAt = new Map<string, string>();
    const unpublished: string[] = [];
    const steps = planSave(snapshot, snapshot.id === null ? null : base);
    let failure: string | null = null;

    for (const step of steps) {
      if (step.op === "unpublishSpot") {
        const res = await outcome(api.admin.spots({ id: step.id }).unpublish.post());
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        const next: PlaceDraft = { ...placeFromServer(res.data.spot), key: step.key };
        freshUpdatedAt.set(step.key, next.updatedAt!);
        unpublished.push(next.nameJa || t`名前のない経由地`);
        base = { ...base, places: base.places.map((p) => (p.key === step.key ? next : p)) };
        setSavedCopy(base);
      } else if (step.op === "deleteSpot") {
        const res = await outcome(api.admin.spots({ id: step.id }).delete());
        if (!res.ok) {
          failure = messages[res.key];
          break;
        }
        base = { ...base, places: base.places.filter((p) => p.key !== step.key) };
        setSavedCopy(base);
      } else if (step.op === "createRoute") {
        const res = await outcome(api.admin.routes.post(withLegIds(step.body, ids)));
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
        const res = await outcome(api.admin.routes({ id: routeId! }).patch({ updatedAt: routeUpdatedAt!, ...withLegIds(step.body, ids) }));
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
        const res = await outcome(api.admin.spots({ id: step.id }).patch({ updatedAt: freshUpdatedAt.get(step.key) ?? current.updatedAt!, ...step.body }));
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
      // A waypoint that was taken off the site before the failure stays off: say so.
      const names = unpublished.join("、");
      setMessage({ kind: "error", text: unpublished.length > 0 ? `${failure} ${t`すでに公開をやめた経由地があります（${names}）。「経由地」タブで確かめてください。`}` : failure }, found);
      setSaving(false);
      return;
    }

    // Take over what the server now holds, so the screen shows the truth (and the next save has fresh times).
    const fresh = await outcome(api.admin.routes({ id: routeId! }).get());
    if (fresh.ok) {
      const next = draftFromServer(fresh.data.route, fresh.data.spots);
      const index = snapshot.places.findIndex((p) => p.key === selectedKey);
      dispatch({ type: "loaded", draft: keepLaterEdits(restoreHeld(next, draft, held), draft, draftRef.current) });
      setSavedCopy(next);
      setSelectedKey(index >= 0 ? (next.places[index]?.key ?? null) : null);
      attempted.current = null;
    }
    const heldCount = held.size;
    setMessage(
      heldCount === 0
        ? { kind: unsourced ? "error" : "ok", text: unsourced ? t`保存しました。ただし、情報源が空のため、線は「確認していない」状態で保存しました。情報源を入れて、もう一度保存してください。` : t`保存しました。` }
        : { kind: "error", text: t`保存しました。ただし、未完成の経由地が${heldCount}件あり、まだ保存していません（赤く示した項目）。` },
      heldCount === 0 ? [] : found,
    );
    setProblems(heldCount === 0 ? [] : found);
    setSaving(false);
    if (snapshot.id === null) router.replace(`/admin/routes/${routeId}`);
  }

  /**
   * Saves one waypoint on its own: the rest of the draft (the route's fields, the other waypoints, the order) stays as typed.
   * The same steps as a full save, planned against a copy of the saved route that has only this waypoint edited.
   */
  async function savePlace(key: string) {
    const place = draft.places.find((p) => p.key === key);
    const before = savedRef.current;
    if (!place || !before.id || saving || busyKey) return;
    const found = draftProblems({ ...before, places: [place] }).filter((p) => "key" in p && p.key === key);
    if (found.length > 0) {
      setProblems((old) => [...old.filter((p) => !("key" in p && p.key === key)), ...found]);
      setMessage({ kind: "error", text: t`保存できません。赤く示した項目を直してください。` }, found);
      return;
    }
    setProblems((old) => old.filter((p) => !("key" in p && p.key === key)));
    const isNew = !before.places.some((p) => p.key === key);
    const target: RouteDraft = { ...before, places: isNew ? [...before.places, place] : before.places.map((p) => (p.key === key ? place : p)) };
    setBusyKey(key);
    setMessage(null);
    let current = before.places.find((p) => p.key === key) ?? null;
    let failure: string | null = null;
    let wasPublished = false;
    for (const step of planSave(target, before)) {
      if (step.op === "unpublishSpot") {
        const res = await outcome(api.admin.spots({ id: step.id }).unpublish.post());
        if (!res.ok) { failure = messages[res.key]; break; }
        current = { ...placeFromServer(res.data.spot), key };
        wasPublished = true;
      } else if (step.op === "createSpot") {
        const res = await outcome(api.admin.routes({ id: before.id }).spots.post(step.body));
        if (!res.ok) { failure = messages[res.key]; break; }
        current = { ...placeFromServer(res.data.spot), key };
      } else if (step.op === "updateSpot") {
        const res = await outcome(api.admin.spots({ id: step.id }).patch({ updatedAt: current!.updatedAt!, ...step.body }));
        if (!res.ok) { failure = messages[res.key]; break; }
        current = { ...placeFromServer(res.data.spot), key };
      }
    }
    if (current && current !== (before.places.find((p) => p.key === key) ?? null)) {
      // Whatever was saved before a failure is on the server: take it over, so the next try has fresh times.
      const saved = current;
      dispatch({ type: "savedPlace", key, place: saved });
      setSavedCopy({ ...savedRef.current, places: isNew && !savedRef.current.places.some((p) => p.key === key) ? [...savedRef.current.places, saved] : savedRef.current.places.map((p) => (p.key === key ? saved : p)) });
    }
    if (failure) setMessage({ kind: "error", text: wasPublished ? `${failure} ${t`この経由地は公開をやめました。`}` : failure });
    else setMessage({ kind: "ok", text: wasPublished ? t`保存しました。この経由地は下書きに戻っています。もう一度「公開する」を押してください。` : t`この経由地を保存しました。` });
    setBusyKey(null);
  }

  // Takes every published waypoint off the site at once. The route itself stays in the list, shown as "coming soon" (準備中).
  async function unpublishAll() {
    const live = draft.places.filter((p) => p.id && p.published);
    if (!draft.id || live.length === 0 || busyKey || saving) return;
    const count = live.length;
    if (!(await confirmDialog({ title: t`公開をやめますか？`, body: t`公開中の${count}か所を、すべて公開をやめます。ルートは「準備中」として一覧に残ります。よろしいですか？`, yes: t`公開をやめる` }))) return;
    setBusyKey("all");
    setMessage(null);
    // One request: the server takes them all back in one step, so it is all or nothing.
    const res = await outcome(api.admin.routes({ id: draft.id })["unpublish-spots"].post());
    if (!res.ok) {
      setMessage({ kind: "error", text: messages[res.key] });
      setBusyKey(null);
      return;
    }
    let places = savedRef.current.places;
    for (const spot of res.data.spots) {
      const key = draft.places.find((p) => p.id === spot.id)?.key;
      if (!key) continue;
      const next: PlaceDraft = { ...placeFromServer(spot), key };
      dispatch({ type: "savedPlace", key, place: next });
      places = places.map((p) => (p.key === key ? next : p));
    }
    setSavedCopy({ ...savedRef.current, places });
    setMessage({ kind: "ok", text: t`${count}か所の公開をやめました。ルートは「準備中」として一覧に残ります。` });
    setBusyKey(null);
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
    if (!(await confirmDialog({ title: t`削除しますか？`, body: t`このルートを削除します。元に戻せません。よろしいですか？`, yes: t`削除する` }))) return;
    const res = await outcome(api.admin.routes({ id: draft.id }).delete());
    if (res.ok) router.replace(`/admin/routes`);
    else setMessage({ kind: "error", text: messages[res.key] });
  }

  // ---- what the form needs -------------------------------------------------------------------------------
  const savedByKey = useMemo(() => new Map(saved.places.map((p) => [p.key, p])), [saved.places]);
  // Places of this course that other courses hold too: listed in the shared block, and removing one asks first.
  const lent = draft.places.flatMap((p) => (p.id && sharedWith[p.id] ? [{ key: p.key, name: locale === "en" && p.nameEn ? p.nameEn : p.nameJa, routeIds: sharedWith[p.id]! }] : []));
  const confirmRemoval = async (key: string) => {
    const one = lent.find((x) => x.key === key);
    if (!one) return true;
    const name = one.name;
    const where = one.routeIds.map((id) => routeNames[id]).filter(Boolean).join(", ");
    return confirmDialog({ title: t`経由地を消しますか？`, body: t`「${name}」は、ほかのコース（${where}）にも置いてあります。消すと、そこからも消えます。よろしいですか？`, yes: t`消す` });
  };
  const problemOf = (kind: DraftProblem["kind"], key?: string) => problems.some((p) => p.kind === kind && (!("key" in p) || p.key === key));
  const prefName: Record<Prefecture, string> = { osaka: t`大阪府`, wakayama: t`和歌山県`, nara: t`奈良県` };
  // A walk that comes back to where it began (周回 or 往復); its first waypoint on the way is the start and the goal.
  const comesBack = draft.walkStyle === "loop" || draft.walkStyle === "out_and_back";
  const firstAlong = draft.places.find((p) => !p.stopBy) ?? null;
  // The numbers on the map are the stamp numbers visitors see; a waypoint without a stamp has none.
  const editorPlaces = (() => {
    let stamp = 0;
    // Where the walk starts and ends, by the same rule as the public map (a round trip or an out-and-back has one start and goal place).
    const along = draft.places.filter((p) => !p.stopBy && p.lat !== null && p.lng !== null);
    const startOnly = comesBack;
    const roleOf = (key: string): StopRole | undefined =>
      key === along[0]?.key ? (startOnly ? "both" : "start") : !startOnly && along.length > 1 && key === along.at(-1)!.key ? "goal" : undefined;
    return draft.places.map((p) => ({ key: p.key, lat: p.lat, lng: p.lng, number: p.stampable ? ++stamp : null, name: p.nameJa, stampable: p.stampable, stopBy: p.stopBy, kind: p.kind, published: p.published, role: roleOf(p.key) }));
  })();
  const text = (field: TextField) => (value: string) => dispatch({ type: "text", field, value });
  const checks = useMemo(() => checklist(factsFromDraft(draft)), [draft]);
  const missingRequired = progress(checks).requiredTotal - progress(checks).requiredDone;

  return (
    <div className={`flex flex-col gap-5 ${saving ? "[&_fieldset]:pointer-events-none" : ""}`} aria-busy={saving}>
      <PublishedEditDialog
        name={pendingEdit ? (draft.places.find((p) => p.key === pendingEdit.key)?.nameJa || t`名前のない経由地`) : null}
        onProceed={() => {
          if (pendingEdit) dispatch(pendingEdit.action);
          setPendingEdit(null);
        }}
        onCancel={() => setPendingEdit(null)}
      />
      {/* Title bar: always in reach, with the one button that matters. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 lg:-mx-8 lg:px-8">
        {back}
        <h1 className="min-w-0 flex-1 break-words text-2xl font-bold">{isNew ? t`新しいルート` : draft.nameJa || t`（名前がありません）`}</h1>
        <p className="text-base text-muted" aria-live="polite">
          {dirty ? t`保存していない変更があります` : isNew ? "" : t`保存済み（更新 ${formatUpdated(locale, draft.updatedAt ?? new Date().toISOString())}）`}
        </p>
        <button type="button" disabled={!dirty || saving || busyKey !== null} onClick={save} className="tap-target rounded-full bg-ink px-8 text-xl font-bold text-paper disabled:opacity-40">
          {saving ? t`保存中…` : t`保存する`}
        </button>
      </div>

      {offerOpen ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-caution bg-surface p-4">
          <p className="min-w-0 flex-1 text-lg font-bold">{t`保存していない編集が、このブラウザに残っています（${offeredAt}）。戻しますか？`}</p>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "loaded", draft: offered.draft });
              setOfferClosed(true);
              setMessage({ kind: "ok", text: t`編集を戻しました。内容を確かめて、「保存する」を押してください。` });
            }}
            className="tap-target rounded-full bg-ink px-5 text-lg font-bold text-paper"
          >
            {t`編集を戻す`}
          </button>
          <button
            type="button"
            onClick={() => {
              writeBackup(localStorage, initial, initial.updatedAt, false);
              setOfferClosed(true);
            }}
            className="tap-target rounded-full border-2 border-line px-5 text-lg font-bold"
          >
            {t`捨てる`}
          </button>
        </div>
      ) : null}

      {/* Narrow screens: one thing at a time. */}
      <div className="flex gap-2 xl:hidden" role="tablist" aria-label={t`表示の切り替え`}>
        {(["edit", "preview"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`tap-target flex-1 rounded-full border-2 text-lg font-bold ${view === id ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {id === "edit" ? t`入力` : t`プレビュー`}
          </button>
        ))}
      </div>

      {/* The map tab uses the whole width (the map and its waypoint list); every other tab has the live preview beside it. */}
      <div className={`grid gap-6 ${section === "map" ? "" : "xl:grid-cols-[minmax(0,1fr)_27rem]"}`}>
        <div className={`flex min-w-0 flex-col gap-5 ${view === "edit" ? "" : "hidden xl:flex"}`}>
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
                className={`tap-target inline-flex items-center gap-2 rounded-full border-2 px-4 text-lg font-bold ${section === id ? "border-ink bg-ink text-paper" : "border-line"}`}
              >
                {TAB_ICONS[id]}
                {labels.tab[id]}
                {id === "check" && missingRequired > 0 ? <span className="ml-2 rounded-full bg-danger px-2 text-base text-paper">{missingRequired}</span> : null}
              </button>
            ))}
          </nav>

          <div id="editor-panel" role="tabpanel" aria-labelledby={`tab-${section}`} className="flex flex-col gap-5">
            {section === "overview" ? (
              <>
                <Section title={t`基本`}>
                  <MultilingualField id="route-name" field="name" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`ルートの名前`} ja={draft.nameJa} en={draft.nameEn} onJa={text("nameJa")} onEn={text("nameEn")} required invalid={problemOf("route_name")} />
                  <Field label={t`ルートの名前の読み（ふりがな）`} htmlFor="ruby-0" hint={t`読みを入れた漢字の上に、小さく表示されます（ひらがな）。`}>
                    <RubyEditor name={draft.nameJa} value={draft.nameKana} onChange={text("nameKana")} />
                  </Field>
                  {problemOf("route_name") ? <p role="alert" className="text-base font-bold text-danger">{t`日本語の名前を入れてください。`}</p> : null}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t`都道府県`} htmlFor="route-pref">
                      <select id="route-pref" value={draft.prefecture ?? ""} onChange={(e) => {
                          const next = (e.target.value || null) as Prefecture | null;
                          // A city of the old prefecture does not belong to the new one: start the city again.
                          if (isListedMunicipality(draft.prefecture, draft.municipality) && !isListedMunicipality(next, draft.municipality)) text("municipality")("");
                          dispatch({ type: "prefecture", value: next });
                        }} className={inputClass}>
                        <option value="">{t`未選択`}</option>
                        {(["wakayama", "osaka", "nara"] as const).map((p) => (
                          <option key={p} value={p}>
                            {prefName[p]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <MunicipalityField id="route-muni" prefecture={draft.prefecture} value={draft.municipality} onChange={text("municipality")} />
                    <Field label={t`歩き方`} htmlFor="route-walk-style" hint={t`「スタート・ゴール」の見せ方が変わります。`}>
                      <select id="route-walk-style" value={draft.walkStyle ?? ""} onChange={(e) => dispatch({ type: "walkStyle", value: walkStyleOf(e.target.value) })} className={inputClass}>
                        <option value="">{t`未選択`}</option>
                        <option value="one_way">{t`片道（別の場所へ）`}</option>
                        <option value="loop">{t`周回（元の場所へ）`}</option>
                        <option value="out_and_back">{t`往復（同じ道）`}</option>
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section title={t`数字`}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t`距離`} htmlFor="route-distance" hint={draft.distanceManual ? t`手入力（空にすると、線から自動）` : t`線から自動で計算`}>
                      <NumberInput id="route-distance" value={draft.distanceKm} min={0} max={2000} suffix="km" onChange={(v) => dispatch({ type: "distance", value: v })} />
                    </Field>
                    <Field label={t`登り（獲得標高）`} htmlFor="route-climb" hint={draft.climbManual ? t`手入力（空にすると、標高から自動）` : t`線の標高から自動で計算`}>
                      <NumberInput id="route-climb" value={draft.elevationGainM} min={0} max={10000} integer suffix="m" onChange={(v) => dispatch({ type: "climb", value: v })} />
                    </Field>
                    <Field label={t`歩く時間`} htmlFor="route-time" hint={draft.timeManual ? t`手入力（空にすると、距離と登りから自動）` : t`距離と登りから自動で計算`}>
                      <NumberInput id="route-time" value={draft.expectedTimeMin} min={0} max={20000} integer suffix={t`分`} onChange={(v) => dispatch({ type: "time", value: v })} />
                    </Field>
                  </div>
                  <GradingFields
                    draft={draft}
                    descentM={walkedStats(draft.line, draft.legs).descent}
                    onPhysical={(value) => dispatch({ type: "physicalLevel", value })}
                    onTechnical={(value) => dispatch({ type: "technicalLevel", value })}
                  />
                  <details className="rounded-xl border border-line bg-paper px-4 py-2" open={draft.difficulty !== ""}>
                    <summary className="cursor-pointer text-base font-bold">{t`むずかしさを、ひとことで書く（任意）`}</summary>
                    <div className="mt-2">
                      <Field label={t`むずかしさ（ひとこと）`} htmlFor="route-difficulty" hint={t`入れた文字が、そのまま表示されます。体力度・技術度を選んだときは、そちらを先に表示します。`}>
                        <TextInput id="route-difficulty" value={draft.difficulty} onChange={text("difficulty")} maxLength={100} />
                      </Field>
                    </div>
                  </details>
                </Section>

                <Section title={t`写真と動画`}>
                  <PhotoUpload onUploaded={text("photoUrl")} />
                  <PhotoLinkDetails open={problemOf("photo_link")}>
                    <Field label={t`ルートの写真のリンク`} htmlFor="route-photo" hint={t`https:// で始まるリンクを入れます。空にすると、写真は表示されません。`}>
                      <TextInput id="route-photo" value={draft.photoUrl} onChange={text("photoUrl")} maxLength={500} invalid={problemOf("photo_link")} />
                    </Field>
                  </PhotoLinkDetails>
                  <Field label={t`写真の出どころ`} htmlFor="route-photo-credit" hint={t`写真の上や下に ℹ︎ と一緒に表示されます。撮った人や、写真を載せているサイトを書きます。リンクは [表示する文字](https://…) と書きます。`}>
                    <TextInput id="route-photo-credit" value={draft.photoCredit} onChange={text("photoCredit")} maxLength={500} />
                  </Field>
                  {problemOf("photo_link") ? <p role="alert" className="text-base font-bold text-danger">{t`写真のリンクは、https:// で始まるものだけ使えます。`}</p> : null}
                  <PhotoSlot url={draft.photoUrl} className="max-w-md" />
                  <Field label={t`動画のリンク（YouTube・Vimeo、またはアップロードした動画）`} htmlFor="route-video" hint={t`https:// で始まるリンクを入れます。空にすると、動画は表示されません。`}>
                    <TextInput id="route-video" value={draft.videoUrl} onChange={text("videoUrl")} maxLength={500} invalid={problemOf("video_link")} />
                  </Field>
                  <VideoUpload onUploaded={text("videoUrl")} />
                  {draft.id ? <VideoHistory routeId={draft.id} onPick={text("videoUrl")} /> : null}
                  {parseVideoFile(draft.videoUrl) ? <SubtitleUpload videoUrl={draft.videoUrl} uploaded={draft.videoSubtitles} onUploaded={() => dispatch({ type: "videoSubtitles", value: true })} /> : null}
                  {problemOf("video_link") ? <p role="alert" className="text-base font-bold text-danger">{t`YouTube か Vimeo、またはアップロードした動画の、https:// で始まるリンクにしてください。`}</p> : null}
                </Section>

                <Section title={t`英語版の動画`}>
                  <Field label={t`英語版の動画のリンク（YouTube、またはアップロードした動画）`} htmlFor="route-video-en" hint={t`英語でサイトを見ている人に、日本語の動画のかわりに表示されます。空にすると、日本語の動画がそのまま表示されます。`}>
                    <TextInput id="route-video-en" value={draft.videoUrlEn} onChange={text("videoUrlEn")} maxLength={500} invalid={problemOf("video_link_en")} />
                  </Field>
                  <VideoUpload onUploaded={text("videoUrlEn")} />
                  {parseVideoFile(draft.videoUrlEn) ? <SubtitleUpload language="en" videoUrl={draft.videoUrlEn} uploaded={draft.videoSubtitlesEn} onUploaded={() => dispatch({ type: "videoSubtitlesEn", value: true })} /> : null}
                  {problemOf("video_link_en") ? <p role="alert" className="text-base font-bold text-danger">{t`YouTube、またはアップロードした動画の、https:// で始まるリンクにしてください。`}</p> : null}
                </Section>

                {draft.id ? <RouteHistory routeId={draft.id} locale={locale} /> : null}
              </>
            ) : null}

            {section === "text" ? (
              <>
                <Section title={t`ルートの説明`}>
                  <MultilingualField id="route-desc" field="description" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`ルートの説明`} ja={draft.descriptionJa} en={draft.descriptionEn} onJa={text("descriptionJa")} onEn={text("descriptionEn")} long="short" />
                </Section>
                <Section title={t`歴史・由来`}>
                  <MultilingualField id="route-history" field="history" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`歴史・由来`} ja={draft.historyJa} en={draft.historyEn} onJa={text("historyJa")} onEn={text("historyEn")} long="short" />
                </Section>
                <Section title={t`アクセス・交通`}>
                  <Field label={t`遠いとみなす距離`} htmlFor="route-far" hint={t`コースからこれより離れていると、ナビは歩く道ではなく、電車やバスでの行き方を案内します。空なら 5 km。`}>
                    <NumberInput id="route-far" value={draft.farDistanceM} min={500} max={200000} integer suffix="m" onChange={(v) => dispatch({ type: "farDistanceM", value: v })} />
                  </Field>
                  <AccessPointsEditor value={draft.accessPoints} onChange={(value) => dispatch({ type: "accessPoints", value })} />
                  <MultilingualField id="route-access" field="access" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`アクセス・交通の補足`} ja={draft.accessJa} en={draft.accessEn} onJa={text("accessJa")} onEn={text("accessEn")} long="short" />
                  <p className="text-base text-muted">{t`上の一覧に入らない行き方（乗りかえ、時刻、帰りの方法など）を、自由に書きます。`}</p>
                </Section>
                <Section title={t`出典`}>
                  <MultilingualField id="route-source" field="source" translations={draft.translations} onTranslations={(v) => dispatch({ type: "translations", value: v })} label={t`出典`} ja={draft.sourceJa} en={draft.sourceEn} onJa={text("sourceJa")} onEn={text("sourceEn")} long="short" />
                  <p className="text-base text-muted">{t`この文章のもとにした資料や、確かめた公式サイトを書きます。ルートのページの下に表示されます。`}</p>
                </Section>
              </>
            ) : null}

            {section === "map" ? (
              <Section title={t`地図と線`} id="map-section">
                {draft.id ? (
                  <NearbyPlacesManager
                    routeId={draft.id}
                    from={(() => {
                      const ref = draft.places.find((p) => p.lat !== null && p.lng !== null);
                      return ref && ref.lat !== null && ref.lng !== null ? { lat: ref.lat, lng: ref.lng } : null;
                    })()}
                  />
                ) : null}
                <MapEditorLoader
                  line={draft.line}
                  legs={draft.legs}
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
                  onHeights={(points) => dispatch({ type: "elevations", points })}
                  onSetLeg={(leg) => dispatch({ type: "setLeg", leg })}
                  onSetLegs={(legs) => dispatch({ type: "setLegs", legs })}
                  onClearLeg={(from, to) => dispatch({ type: "clearLeg", from, to })}
                  onClearLegs={() => dispatch({ type: "clearLegs" })}
                  onSplitLine={() => dispatch({ type: "splitLine" })}
                  onReorderPlaces={(keys) => dispatch({ type: "reorderPlaces", keys })}
                  onAddPlace={(lat, lng, after) => {
                    const key = crypto.randomUUID();
                    dispatch({ type: "addPlace", key, lat, lng, after });
                    setSelectedKey(key);
                  }}
                  onAddEndAt={(from) => {
                    const start = draft.places.find((p) => p.key === from);
                    if (!start || start.lat === null || start.lng === null) return;
                    const key = crypto.randomUUID();
                    const name = start.nameJa.trim() || t`出発点`;
                    const nameEn = start.nameEn.trim();
                    // Not a stamp place (the start already is one, and a stamp is once per place); the position and what checked it are the start's own.
                    dispatch({
                      type: "addPlace",
                      key,
                      lat: start.lat,
                      lng: start.lng,
                      kind: start.kind,
                      patch: {
                        stampable: false,
                        nameJa: t`${name}（終点）`,
                        nameEn: nameEn ? t`${nameEn} (end)` : "",
                        positionVerified: start.positionVerified,
                        positionSource: start.positionSource,
                      },
                    });
                    setSelectedKey(key);
                  }}
                  onAddPlaces={(list) => dispatch({ type: "addPlaces", places: list })}
                  onMovePlace={(key, lat, lng) => guarded(key, { type: "movePlace", key, lat, lng })}
                  onRemovePlace={(key) => {
                    const p = draft.places.find((x) => x.key === key);
                    if (p?.published) setMessage({ kind: "error", text: t`公開中の経由地は消せません。先に「公開をやめる」を押してください。` });
                    else void confirmRemoval(key).then((yes) => yes && dispatch({ type: "removePlace", key }));
                  }}
                  onSelectPlace={setSelectedKey}
                  onPatchPlace={(key, patch) => {
                    const p = draft.places.find((x) => x.key === key);
                    // A new waypoint's stamp switch follows its kind; a saved one keeps what was chosen for it.
                    if (p) guarded(key, { type: "place", key, patch: patch.kind && p.id === null ? { ...patch, stampable: stampableByDefault(patch.kind) } : patch });
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
                    <TextInput id="route-line-source" value={draft.lineSource} onChange={text("lineSource")} maxLength={500} invalid={draft.lineVerified && draft.lineSource.trim() === ""} />
                  </Field>
                  {draft.lineVerified && draft.lineSource.trim() === "" ? <p role="alert" className="text-base font-bold text-danger">{t`情報源を入れないと、「確認した」は保存されません。`}</p> : null}
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
                      className={`tap-target rounded-full border-2 px-5 text-lg font-bold ${placesView === v ? "border-ink bg-ink text-paper" : "border-line"}`}
                    >
                      {v === "table" ? t`表でまとめて入力` : t`1か所ずつ詳しく`}
                    </button>
                  ))}
                </div>
                {firstAlong ? (
                  // The same setting as 歩き方 in 基本 (周回 / 往復 come back to the start): visitors then see this place as the start and again as the goal, one page and one stamp.
                  <div className="rounded-xl border-2 border-line bg-paper px-4">
                    <Check
                      id="route-start-is-goal"
                      checked={comesBack}
                      onChange={(on) => dispatch({ type: "walkStyle", value: on ? (draft.walkStyle === "out_and_back" ? "out_and_back" : "loop") : "one_way" })}
                    >
                      {t`「${firstAlong.nameJa || t`1番目の経由地`}」をゴールにもする（出発した場所にもどる）`}
                    </Check>
                    {comesBack ? <p className="pb-3 text-base text-muted">{t`もどりの経由地を別に作る必要はありません。利用者には、スタートとゴールの両方にこの場所が表示されます。`}</p> : null}
                  </div>
                ) : null}
                {placesView === "table" ? (
                  <PlaceTable
                    places={draft.places}
                    busy={busyKey !== null || saving}
                    invalidName={(key) => problemOf("place_name", key)}
                    onChange={(key, patch) => guarded(key, { type: "place", key, patch })}
                    onRemove={(key) => void confirmRemoval(key).then((yes) => yes && dispatch({ type: "removePlace", key }))}
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
                        onChange={(patch) => guarded(p.key, { type: "place", key: p.key, patch })}
                        onRemove={async () => {
                          if (!(await confirmRemoval(p.key))) return;
                          dispatch({ type: "removePlace", key: p.key });
                          setSelectedKey(null);
                        }}
                        onMove={(step) => {
                          const keys = draft.places.map((x) => x.key);
                          const j = i + step;
                          [keys[i], keys[j]] = [keys[j]!, keys[i]!];
                          dispatch({ type: "reorderPlaces", keys });
                        }}
                        canSave={draft.id !== null}
                        onSave={() => void savePlace(p.key)}
                        onPublish={() => setPublished(p.key, true)}
                        onUnpublish={() => setPublished(p.key, false)}
                      />
                    ))}
                  </ol>
                )}
                {problems.some((p) => p.kind === "place_position") ? <p role="alert" className="text-base font-bold text-danger">{t`緯度と経度は、両方入れるか、両方空にしてください。`}</p> : null}
                {draft.id ? <SharedPlaces routeId={draft.id} initial={shared} lent={lent} routeNames={routeNames} locale={locale} /> : null}
                {draft.places.some((p) => p.id && p.published) ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-3">
                    <button type="button" disabled={busyKey !== null} onClick={() => void unpublishAll()} className="tap-target rounded-full border-2 border-danger px-5 text-lg font-bold text-danger disabled:opacity-40">
                      {busyKey === "all" ? t`処理しています…` : t`すべての公開をやめる`}
                    </button>
                    <p className="min-w-0 flex-1 text-base text-muted">{t`公開中の経由地をまとめて下書きに戻します。ルートは「準備中」として、一覧に残ります。`}</p>
                  </div>
                ) : null}
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
                            <span className={`w-20 shrink-0 rounded-lg px-3 py-1 text-center text-base font-bold ${i.done ? "bg-moss text-paper" : required ? "bg-danger text-paper" : "bg-surface"}`}>{i.done ? t`できた` : t`まだ`}</span>
                            <span className="min-w-0 flex-1 text-lg">{labels.item[i.id]}</span>
                            {!i.done ? (
                              <button type="button" onClick={() => setSection(i.tab)} className="tap-target rounded-full border border-ink px-4 text-base font-bold">
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
              <button type="button" onClick={deleteRoute} disabled={draft.places.length > 0 || saving} className="tap-target w-fit rounded-full border-2 border-danger px-5 text-lg font-bold text-danger disabled:opacity-40">
                {t`このルートを削除`}
              </button>
              {draft.places.length > 0 ? <p className="text-base text-muted">{t`経由地が残っているルートは削除できません。`}</p> : null}
            </div>
          ) : null}
        </div>

        <div className={`min-w-0 ${view === "preview" ? "" : section === "map" ? "hidden" : "hidden xl:block"}`}>
          {/* Never taller than the screen (so its bottom is always reachable), and the browser is told not to re-anchor the page to it while it scrolls inside. */}
          <div className="xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto [contain:paint] [overflow-anchor:none]">
            <LivePreview draft={draft} order={order} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}

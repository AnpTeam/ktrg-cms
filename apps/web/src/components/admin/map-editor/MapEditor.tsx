"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import { isAllSmooth } from "@/lib/admin/drawn-path";
import { parseGpx, type GpxWaypoint } from "@/lib/admin/gpx";
import { applyGpxElevations } from "@/lib/admin/gpx-elevation";
import { LEG_HIT, LEG_SOURCE, legFeatures, legLayers } from "@/lib/admin/leg-map";
import { backChoices, backLeg, backPairs, guideRoute, insertAnchor, insertGuidePoint, legFromPath, legOf, MAX_GUIDE_POINTS, moveAnchor, moveGuidePoint, pairId, pairsOf, pathOfLeg, pathStops, pointsFromAnchors, removeAnchors, removeGuidePoint, RIDE_MODES, setAllCurves, sidePairs, toggleAnchorCurve, type GuidePoint, type Leg, type Path, type RideMode, type Stop } from "@/lib/admin/legs";
import { simplify, type LngLatEle } from "@/lib/admin/line";
import { legTime } from "@/lib/leg-times";
import { searchPlaces, type PlaceHit } from "@/lib/admin/place-search";
import { buildLine, closeLineGaps, smoothLine } from "@/lib/admin/route-builder";
import { roundLine, type SnapPoint } from "@/lib/admin/snap";
import { boundsOf, editorBaseVisibility, editorBases, editorStyle, terrainLayerId, zoomLimits, type EditorBase } from "@/lib/map";
import { type PointKind } from "@/lib/point-kinds";
import { CursorIcon, FitIcon, GuideIcon, PencilIcon, PinIcon, RedoIcon, TerrainIcon, TrashIcon, UndoIcon } from "./icons";
import { PlaceList } from "./PlaceList";
import { createMarkerElement } from "@/components/map/MapMarker";
import type { StopRole } from "@/lib/route-stops";

export interface EditorPlace {
  key: string;
  lat: number | null;
  lng: number | null;
  /** The number on the marker: its place among the waypoints with a stamp. A waypoint without a stamp is a small dot (null). */
  number: number | null;
  name: string;
  stampable: boolean;
  /** An optional visit beside the way (寄り道): the line need not pass through it. */
  stopBy: boolean;
  kind: PointKind;
  /** Visitors can see it: it cannot be deleted, and editing it turns it back into a draft. */
  published: boolean;
  /** Where the walk starts and ends (blue and orange pins), as visitors see it. */
  role?: StopRole;
}

/** What the list under the map can change on a waypoint. */
export interface PlacePatch {
  nameJa?: string;
  kind?: PointKind;
  stampable?: boolean;
  stopBy?: boolean;
}

export type ElevationStatus = "idle" | "loading" | "partial";

export interface MapEditorProps {
  /** The whole line (the legs joined): for the length, for fitting the view. */
  line: LngLatEle[];
  /** The line cut into one leg for each pair of stops. Drawing or finding a leg never touches the others. */
  legs: Leg[];
  places: EditorPlace[];
  selectedKey: string | null;
  distanceKm: number | null;
  climbM: number | null;
  elevationStatus: ElevationStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** A whole track (a GPX file): the draft cuts it into legs at the stops. */
  onLine: (points: LngLatEle[]) => void;
  onSetLeg: (leg: Leg) => void;
  /** Several legs at once, as one step to undo. This is the full list of legs. */
  onSetLegs: (legs: Leg[]) => void;
  onClearLeg: (from: string, to: string) => void;
  onClearLegs: () => void;
  /** The same line with new elevations (taken from a GPX file); the shape does not change. */
  onHeights: (points: LngLatEle[]) => void;
  /** Cut the loose line into legs at the stops even though they do not follow it. */
  onSplitLine: () => void;
  /** `after`: put it right after this waypoint (between two others) instead of at the end. */
  onAddPlace: (lat: number, lng: number, after?: string) => void;
  /** The waypoints in a new order (all keys). Legs that still join neighbours stay; the others are reconciled. */
  onReorderPlaces: (keys: string[]) => void;
  /** A route that ends where it starts: adds an end point (not a stamp place) at exactly the position of this waypoint. */
  onAddEndAt: (key: string) => void;
  /** Several places at once (the named points of a GPX file). */
  onAddPlaces: (places: { key: string; name: string; lat: number; lng: number }[]) => void;
  onMovePlace: (key: string, lat: number, lng: number) => void;
  onRemovePlace: (key: string) => void;
  onSelectPlace: (key: string | null) => void;
  /** Changes a waypoint's name, kind, stamp switch or side-trip switch. */
  onPatchPlace: (key: string, patch: PlacePatch) => void;
  /** Asks the route-finding service for a walking line through these points (the editor says what went wrong). */
  onSnap: (points: SnapPoint[]) => Promise<{ ok: true; line: LngLatEle[] } | { ok: false; message: string }>;
}

// Four tools for the person: select (move the map, move stops, move the points of the chosen leg), add a stop, draw a leg, and
// put guide points on a leg (invisible marks that tell the route-finding service which way to go, like Navivi's via points).
type Mode = "pan" | "place" | "draw" | "guide";

const MAX_POINTS = 2000;
const NO_PATH: Path = { anchors: [], curves: [] };
// Where the map starts when there is nothing to show yet: the Katsuragi area.
const START = { center: [135.45, 34.45] as [number, number], zoom: 9 };
// A point of the chosen leg (Navivi's anchor): a square is a sharp corner, a circle is a smooth bend.
const anchorClass =
  "block size-3.5 min-h-0 min-w-0 cursor-grab rounded-[3px] border-2 border-white bg-ink p-0 shadow-md active:cursor-grabbing data-[smooth=true]:size-4 data-[smooth=true]:rounded-full data-[selected=true]:bg-brand data-[selected=true]:ring-2 data-[selected=true]:ring-ink";
// A guide point of the chosen leg: a dashed orange ring. Visitors never see it; it only steers the route-finding service.
const guideClass =
  "block size-4 min-h-0 min-w-0 cursor-grab rounded-full border-[3px] border-dashed border-[var(--color-goal)] bg-paper p-0 shadow-md active:cursor-grabbing";
const chipClass = "inline-flex h-11 min-h-0 min-w-0 items-center justify-center gap-1.5 rounded-full border border-line bg-paper px-3 text-sm font-bold hover:bg-surface disabled:opacity-40 disabled:hover:bg-paper";
const floatClass = "flex items-center gap-0.5 rounded-xl border border-line bg-paper/95 p-1 shadow-md backdrop-blur-sm";
const iconBtn = "inline-flex shrink-0 whitespace-nowrap h-11 min-h-0 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-bold [&:not([aria-pressed=true])]:hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent";
const toolClass = "tap-target inline-flex items-center justify-center rounded-full border-2 px-3 text-base font-bold disabled:opacity-40";

type Actions = {
  collection: (preview: { id: string; points: LngLatEle[] } | null) => ReturnType<typeof legFeatures>;
  redraw: (preview: { id: string; points: LngLatEle[] } | null) => void;
  mapClick: (e: MapMouseEvent) => void;
  clickAnchor: (i: number) => void;
  toggleAnchor: (i: number) => void;
  previewAnchor: (i: number, at: { lat: number; lng: number }) => void;
  dropAnchor: (i: number, at: { lat: number; lng: number }) => void;
  chooseTool: (tool: "select" | "place" | "draw" | "guide") => void;
  clickGuide: (i: number) => void;
  dropGuide: (i: number, at: { lat: number; lng: number }) => void;
  toggleEraser: () => void;
  removeChosenAnchor: () => void;
  hasAnchor: () => boolean;
  leaveDraw: () => void;
};

/** A leg's points with both ends exactly on its stops (a router's line is rounded, or stops short of them). */
function withEnds(line: readonly LngLatEle[], from: Stop, to: Stop): LngLatEle[] {
  return [[from.lng, from.lat], ...line.slice(1, -1), [to.lng, to.lat]];
}

type Pair = { from: Stop; to: Stop; side?: true; back?: true };

/** The leg of a chosen waypoint: the one that starts there, or the side trip that leads to it. */
const legOfWaypoint = (pairs: readonly Pair[], key: string | null): Pair | undefined =>
  pairs.find((p) => !p.side && !p.back && p.from.key === key) ?? pairs.find((p) => p.side && p.to.key === key);

/** The leg to start drawing: the one of the chosen waypoint, else the first pair without a leg, else the first pair. */
function firstLeg(pairs: readonly Pair[], legs: readonly Leg[], selectedKey: string | null): string | null {
  const own = legOfWaypoint(pairs, selectedKey);
  const empty = pairs.find((p) => !legOf(legs, p.from.key, p.to.key));
  const first = own ?? empty ?? pairs[0];
  return first ? pairId(first) : null;
}

export function MapEditor(props: MapEditorProps) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>("pan");
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [terrain, setTerrain] = useState(false);
  const [base, setBase] = useState<EditorBase>("std");
  const [waypoints, setWaypoints] = useState<GpxWaypoint[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlaceHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  // The leg being worked on, named by the key of its first stop; and the point of it that is chosen (new points go after it).
  const [chosenId, setActiveId] = useState<string | null>(null);
  const [anchorAt, setAnchorAt] = useState<{ from: string | null; index: number } | null>(null);
  const [eraser, setEraser] = useState(false);
  // With the place tool, the next pin goes right after the chosen waypoint (the new pin is chosen in turn, so pins chain in order).
  // "Add after this" in the list turns it off again (afterOff) until another tool is used.
  const [afterOff, setAfterOff] = useState(false);
  const insertAfterRef = useRef<string | null>(null);
  // A waypoint that has no position yet: the next click on the map gives it one (any tool; the click is not used for anything else).
  const [locating, setLocating] = useState<string | null>(null);
  const locatingRef = useRef<string | null>(null);
  useEffect(() => {
    locatingRef.current = locating;
  });
  const insertAfter = mode === "place" && !afterOff ? props.selectedKey : null;
  useEffect(() => {
    insertAfterRef.current = insertAfter;
  });

  const container = useRef<HTMLDivElement>(null);
  const heightsInput = useRef<HTMLInputElement>(null);
  const [gpxMenu, setGpxMenu] = useState(false);
  useEffect(() => {
    if (!gpxMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element | null)?.closest?.('[aria-haspopup="menu"], [role="menu"]')) setGpxMenu(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [gpxMenu]);
  const fileInput = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement; shape: string }>());
  const anchorMarkers = useRef<Marker[]>([]);
  const guideMarkers = useRef<Marker[]>([]);
  const justDragged = useRef(false);
  const modeRef = useRef<Mode>("pan");
  const latest = useRef(props);
  const actions = useRef<Actions>({} as Actions);

  // The handlers below are created once; they read the newest props and mode through these refs.
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ---- the stops, the legs between them, and the one being worked on -----------------------------------------------
  const stops = useMemo(() => pathStops(props.places), [props.places]);
  // The legs of the route, then the side trips out to the stop-by places. A leg is named by the stop it runs to (unique, also for a side trip).
  // Then the way back (return legs, 戻る道): a leg per pair of stops, named by both its stops (it can end on a stop another leg ends on).
  const pairs: Pair[] = useMemo(
    () => [...pairsOf(stops), ...sidePairs(props.places).map((p) => ({ ...p, side: true as const })), ...backPairs(stops, props.legs).map((p) => ({ ...p, back: true as const }))],
    [stops, props.places, props.legs],
  );
  // A leg drawn again on a return pair stays a return leg (the places that build legs do not know about the kinds).
  const backKeys = new Set(pairs.filter((p) => p.back).map((p) => `${p.from.key}>${p.to.key}`));
  const tagBack = (leg: Leg): Leg => (backKeys.has(`${leg.from}>${leg.to}`) && !leg.back ? { ...leg, back: true } : leg);
  const setLeg = (leg: Leg) => props.onSetLeg(tagBack(leg));
  const setLegs = (legs: Leg[]) => props.onSetLegs(legs.map(tagBack));
  // The chosen leg is read as nothing once its pair of stops is gone, and the chosen point only counts on the leg it was chosen on.
  const activePair = pairs.find((p) => pairId(p) === chosenId) ?? null;
  const activeId = activePair ? pairId(activePair) : null;
  const anchorIdx = anchorAt && anchorAt.from === activeId ? anchorAt.index : null;
  const setAnchorIdx = (index: number | null) => setAnchorAt(index === null ? null : { from: activeId, index });
  const activeLeg = activePair ? legOf(props.legs, activePair.from.key, activePair.to.key) : undefined;
  const activePath = useMemo(() => (activeLeg ? pathOfLeg(activeLeg) : NO_PATH), [activeLeg]);
  const nameOf = useMemo(() => new Map(props.places.map((p) => [p.key, p.name || t`（名前がありません）`])), [props.places, t]);

  // ---- what the handlers do (created each render so they see this render's state; the map calls them through `actions`) ----
  /** Edits the path of the chosen leg (a leg that has none yet starts from no points) and saves the result as that leg. */
  function editPath(update: (p: Path) => Path) {
    if (!activePair) return;
    const next = update(activePath);
    setLeg({ ...legFromPath(activePair.from, activePair.to, next), ...(activeLeg?.ride ? { ride: activeLeg.ride } : {}), ...(activeLeg?.via ? { via: activeLeg.via } : {}) });
  }

  /**
   * Finds the way of the chosen leg again through these guide points (Navivi's via points): the route-finding service is given the
   * two stops with the guide points between them, so it cannot pick a shorter but worse way. The guide points stay on the leg for
   * the next time. When no way is found the guide points are kept and the line is left as it was. This is one search of the
   * route-finding service (a limited allowance shared by everyone), so it runs only when the person asks (the 道を探す button),
   * never on its own after a guide point is added, moved or removed.
   */
  async function routeThroughGuides(via: GuidePoint[]) {
    if (!activePair || working) return;
    const { from, to } = activePair;
    const own = activeLeg;
    const keep = { ...(own?.ride ? { ride: own.ride } : {}), ...(activePair.side ? { side: true as const } : {}), ...(via.length > 0 ? { via } : {}) };
    const points = guideRoute(from, to, via);
    setWorking(true);
    setNote(via.length > 0 ? t`ガイド点を通る道を調べています…` : t`道を調べています…`);
    let line: LngLatEle[] | null = null;
    let message = "";
    let fellBack = false;
    const result = await props.onSnap(points);
    if (result.ok) line = await closeLineGaps(result.line, points);
    else {
      message = result.message;
      // The service is not set up, is over its allowance or did not answer: GSI's own trail map does the same job without a key
      // (the note then says so, because it can choose a different way).
      const built = await buildLine(points, "trail");
      if (built.straightHops < points.length - 1) {
        line = built.line;
        fellBack = true;
      }
    }
    setWorking(false);
    if (!line) {
      setLeg({ from: from.key, to: to.key, points: own?.points ?? [[from.lng, from.lat], [to.lng, to.lat]], ...keep });
      return setNote(message || t`道が見つかりませんでした。ガイド点は残してあります。`);
    }
    setLeg({ from: from.key, to: to.key, points: withEnds(simplify(roundLine(line), MAX_POINTS), from, to), ...keep });
    setNote(
      fellBack
        ? t`道の探索サービスが使えなかったため、地図の道（国土地理院）で探しました。いつもと違う道になることがあります。形をよく確かめてください。「元に戻す」で、もとの線にもどせます。`
        : t`ガイド点を通るように、道を引きなおしました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。`,
    );
  }

  /** Puts the guide points on the chosen leg (a leg with no line yet is made straight). It does not search: the 道を探す button does. */
  function changeGuides(via: GuidePoint[]) {
    if (!activePair) return;
    const base: Leg = activeLeg ?? { from: activePair.from.key, to: activePair.to.key, points: [[activePair.from.lng, activePair.from.lat], [activePair.to.lng, activePair.to.lat]] };
    setLeg({ ...base, via: via.length > 0 ? via : undefined }); // (an undefined member is not saved)
    setNote(via.length > 0 ? t`ガイド点を変えました。「道を探す」を押すと、この点を通る道を探します（探すのは1回だけです）。` : t`ガイド点をすべて消しました。線はそのままです。`);
  }

  function makeActions(): Actions {
    return {
    collection: (preview) => legFeatures(pairs, props.legs, activeId, preview, props.line),
    redraw: (preview) => {
      const source = mapRef.current?.getSource(LEG_SOURCE) as GeoJSONSource | undefined;
      source?.setData(actions.current.collection(preview));
    },
    mapClick: (e) => {
      const m = modeRef.current;
      const locate = locatingRef.current;
      if (locate) {
        setLocating(null);
        latest.current.onMovePlace(locate, e.lngLat.lat, e.lngLat.lng);
        latest.current.onSelectPlace(locate);
        return;
      }
      if (m === "place") {
        const after = insertAfterRef.current ?? undefined;
        return latest.current.onAddPlace(e.lngLat.lat, e.lngLat.lng, after);
      }
      if (m === "guide") {
        if (!activePair) return;
        const cur = activeLeg?.via ?? [];
        if (cur.length >= MAX_GUIDE_POINTS) return setNote(t`ガイド点は、1つの区間に${MAX_GUIDE_POINTS}個までです。`);
        changeGuides(insertGuidePoint(activePair.from, activePair.to, cur, [e.lngLat.lng, e.lngLat.lat]));
        return;
      }
      if (m === "draw") {
        if (!activePair) return;
        // New points go after the chosen point, or at the end.
        const at = anchorIdx !== null && anchorIdx < activePath.anchors.length ? anchorIdx + 1 : activePath.anchors.length;
        editPath((p) => insertAnchor(p, at, [e.lngLat.lat, e.lngLat.lng]));
        setAnchorIdx(at);
        return;
      }
      const hit = mapRef.current?.queryRenderedFeatures(e.point, { layers: [LEG_HIT] })[0];
      const id = hit ? (hit.properties as { id?: string } | null)?.id : undefined;
      setActiveId(id ? id : null);
      // Picking a leg (or none) lets go of the waypoint chosen before, so its ring does not stay on while another leg is worked on.
      latest.current.onSelectPlace(null);
    },
    clickAnchor: (i) => {
      if (justDragged.current) return;
      if (eraser) {
        editPath((p) => removeAnchors(p, new Set([i])));
        setAnchorIdx(null);
      } else setAnchorIdx(anchorIdx === i ? null : i);
    },
    toggleAnchor: (i) => editPath((p) => toggleAnchorCurve(p, i)),
    // In the guide tool a guide point is removed by clicking it, or moved by dragging it. Neither searches for a way.
    clickGuide: (i) => {
      if (justDragged.current || modeRef.current !== "guide") return;
      changeGuides(removeGuidePoint(activeLeg?.via ?? [], i));
    },
    dropGuide: (i, at) => {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 250);
      changeGuides(moveGuidePoint(activeLeg?.via ?? [], i, [at.lng, at.lat]));
    },
    previewAnchor: (i, at) => {
      if (!activePair) return;
      const moved = moveAnchor(activePath, i, [at.lat, at.lng]);
      actions.current.redraw({ id: pairId(activePair), points: pointsFromAnchors(activePair.from, activePair.to, moved.anchors, moved.curves) });
    },
    dropAnchor: (i, at) => {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 250);
      editPath((p) => moveAnchor(p, i, [at.lat, at.lng]));
    },
    chooseTool: (tool) => {
      setNote(null);
      setAfterOff(false);
      if (tool === "select") return setMode("pan");
      if (tool === "place") return setMode("place");
      if (pairs.length === 0) return setNote(tool === "guide" ? t`ガイド点を置くには、先に経由地を2つ以上置いてください（寄り道は数えません）。` : t`線を描くには、先に経由地を2つ以上置いてください（寄り道は数えません）。`);
      if (!activePair) setActiveId(firstLeg(pairs, props.legs, props.selectedKey));
      setMode(tool === "guide" ? "guide" : "draw");
    },
    toggleEraser: () => setEraser((e) => !e),
    hasAnchor: () => anchorIdx !== null,
    removeChosenAnchor: () => {
      if (anchorIdx === null) return;
      editPath((p) => removeAnchors(p, new Set([anchorIdx])));
      setAnchorIdx(null);
    },
    leaveDraw: () => {
      setEraser(false);
      setMode("pan");
    },
    };
  }

  // The handlers the map calls are put here after every render, before the effects below use them.
  useEffect(() => {
    actions.current = makeActions();
  });

  // Choosing a waypoint chooses the leg that starts there (adjusted while rendering, the way React recommends).
  const [seenSelected, setSeenSelected] = useState(props.selectedKey);
  if (seenSelected !== props.selectedKey) {
    setSeenSelected(props.selectedKey);
    const own = legOfWaypoint(pairs, props.selectedKey);
    if (own) setActiveId(pairId(own));
  }

  // ---- the map, created once -----------------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    const placeMarkers = markers.current;

    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const { line, places } = latest.current;
      const bounds = boundsOf([...line.map((p) => ({ lng: p[0], lat: p[1] })), ...places.flatMap((p) => (p.lat === null || p.lng === null ? [] : [{ lat: p.lat, lng: p.lng }]))]);
      map = new ml.Map({
        container: container.current,
        style: editorStyle(), // mapping needs the detailed maps; visitors see the one chosen in the site settings
        center: START.center,
        zoom: START.zoom,
        bounds: bounds ?? undefined,
        fitBoundsOptions: { padding: 60, maxZoom: 15, animate: false },
        minZoom: zoomLimits.min,
        maxZoom: zoomLimits.max,
        dragRotate: false,
        pitchWithRotate: false,
        doubleClickZoom: false, // a double click on a point makes it smooth or a corner
        attributionControl: { compact: false },
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", () => {});
      mapRef.current = map;
      mlRef.current = ml;

      let started = false;
      const start = () => {
        if (started || cancelled || !map || !map.isStyleLoaded()) return;
        started = true;
        map.addSource(LEG_SOURCE, { type: "geojson", data: actions.current.collection(null) });
        for (const layer of legLayers()) map.addLayer(layer);
        setReady(true);
      };
      map.on("styledata", start);
      map.on("load", start);
      start();

      // A click on the map: puts a place there (place tool), adds a point to the chosen leg (draw tool), or chooses the leg
      // under the click (select tool).
      map.on("click", (e) => actions.current.mapClick(e));
    })();

    return () => {
      cancelled = true;
      for (const { marker } of placeMarkers.values()) marker.remove();
      placeMarkers.clear();
      for (const m of anchorMarkers.current) m.remove();
      anchorMarkers.current = [];
      for (const m of guideMarkers.current) m.remove();
      guideMarkers.current = [];
      map?.remove(); // CLAUDE.md: the map is always removed on unmount
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- the legs on the map ------------------------------------------------------------------------------------
  useEffect(() => {
    if (ready) actions.current.redraw(null);
  }, [ready, props.legs, props.line, pairs, activeId]);

  // ---- the tool ----------------------------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getCanvas().style.cursor = locating || mode === "place" || ((mode === "draw" || mode === "guide") && activePair) ? "crosshair" : "";
    for (const { marker } of markers.current.values()) marker.setDraggable(mode === "pan" || mode === "place");
  }, [mode, ready, activePair, locating]);

  // ---- the points of the chosen leg ----------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    for (const m of anchorMarkers.current) m.remove();
    anchorMarkers.current = [];
    if (!ready || !map || !ml || !activePair || mode === "place" || mode === "guide") return;
    activePath.anchors.forEach((a, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = anchorClass;
      el.dataset.smooth = String(!!activePath.curves[i]);
      el.dataset.selected = String(i === anchorIdx);
      el.setAttribute("aria-label", `${i + 1}`);
      el.title = eraser ? t`クリックで、この点を消します` : t`ドラッグで動かします。クリックで選び、ダブルクリックでなめらかな点と角の点を切り替えます。`;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.current.clickAnchor(i);
      });
      el.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        event.preventDefault();
        actions.current.toggleAnchor(i);
      });
      const marker = new ml.Marker({ element: el, draggable: !eraser }).setLngLat([a[1], a[0]]).addTo(map);
      marker.on("drag", () => actions.current.previewAnchor(i, marker.getLngLat()));
      marker.on("dragend", () => actions.current.dropAnchor(i, marker.getLngLat()));
      anchorMarkers.current.push(marker);
    });
    return () => {
      for (const m of anchorMarkers.current) m.remove();
      anchorMarkers.current = [];
    };
  }, [ready, activePair, activePath, mode, anchorIdx, eraser, t]);

  // ---- the guide points of the chosen leg ------------------------------------------------------------------------
  // Shown whenever a leg is chosen (so the person knows they are there); moved and removed only with the guide tool.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    for (const m of guideMarkers.current) m.remove();
    guideMarkers.current = [];
    if (!ready || !map || !ml || !activePair || mode === "place") return;
    (activeLeg?.via ?? []).forEach(([lng, lat], i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = guideClass;
      const no = i + 1;
      el.setAttribute("aria-label", t`ガイド点 ${no}`);
      el.title = mode === "guide" ? t`ドラッグで動かします。クリックで消します。` : t`ガイド点（道を探すときの目印）。「ガイド点」の道具で動かしたり消したりできます。`;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.current.clickGuide(i);
      });
      const marker = new ml.Marker({ element: el, draggable: mode === "guide" }).setLngLat([lng, lat]).addTo(map);
      marker.on("dragend", () => actions.current.dropGuide(i, marker.getLngLat()));
      guideMarkers.current.push(marker);
    });
    return () => {
      for (const m of guideMarkers.current) m.remove();
      guideMarkers.current = [];
    };
  }, [ready, activePair, activeLeg, mode, t]);

  // ---- place markers ---------------------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    const wanted = props.places.filter((p) => p.lat !== null && p.lng !== null);
    const keys = new Set(wanted.map((p) => p.key));
    for (const [key, entry] of markers.current) {
      if (!keys.has(key)) {
        entry.marker.remove();
        markers.current.delete(key);
      }
    }
    for (const p of wanted) {
      // The same pins visitors see. A pin is drawn from its number, kind, role and shape, so it is made again when one changes.
      const shape = `${p.number}|${p.stampable}|${p.stopBy}|${p.role ?? ""}|${p.kind}|${p.name}`;
      let entry = markers.current.get(p.key);
      if (entry && entry.shape !== shape) {
        entry.marker.remove();
        markers.current.delete(p.key);
        entry = undefined;
      }
      if (!entry) {
        const el = createMarkerElement({
          order: p.stampable ? p.number : null,
          label: p.stampable ? `${p.number}. ${p.name}` : p.name,
          kind: "neutral",
          status: "open",
          sideTrip: p.stopBy,
          noStamp: !p.stampable,
          role: p.role,
          place: p.kind,
          onSelect: () => {},
        });
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          latest.current.onSelectPlace(p.key);
        });
        const marker = new ml.Marker({ element: el, anchor: p.stopBy ? "center" : "bottom", draggable: modeRef.current === "pan" || modeRef.current === "place" }).setLngLat([p.lng!, p.lat!]).addTo(map);
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          latest.current.onMovePlace(p.key, lat, lng);
        });
        entry = { marker, el, shape };
        markers.current.set(p.key, entry);
      }
      entry.marker.setLngLat([p.lng!, p.lat!]);
      entry.el.dataset.published = String(p.published);
      entry.el.title = p.published ? `${p.name}（公開中）` : p.name;
      entry.el.setAttribute("aria-pressed", String(p.key === props.selectedKey));
    }
  }, [props.places, props.selectedKey, ready]);

  // Keys: V, P and L pick the tool; E toggles the eraser while drawing; Escape leaves drawing; Delete removes the chosen point
  // while drawing and otherwise the chosen waypoint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "v") actions.current.chooseTool("select");
      else if (key === "p") actions.current.chooseTool("place");
      else if (key === "l") actions.current.chooseTool("draw");
      else if (key === "g") actions.current.chooseTool("guide");
      else if (key === "e" && modeRef.current === "draw") actions.current.toggleEraser();
      else if (e.key === "Escape" && locatingRef.current) setLocating(null);
      else if (e.key === "Escape" && (modeRef.current === "draw" || modeRef.current === "guide")) actions.current.leaveDraw();
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        // With the guide tool a guide point is removed by clicking it: Delete never removes a waypoint then.
        if (modeRef.current === "guide") return;
        // A chosen point of the leg goes first; with none chosen, the chosen waypoint.
        if (modeRef.current === "draw" || actions.current.hasAnchor()) actions.current.removeChosenAnchor();
        else if (latest.current.selectedKey) latest.current.onRemovePlace(latest.current.selectedKey);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- toolbar actions -------------------------------------------------------------------------------------
  // Read through `latest`, not `props`: these run from a timeout right after a new line was set (GPX, connect, snap), and
  // the `props` of the render that started the timeout still hold the old line.
  function fit() {
    const map = mapRef.current;
    if (!map) return;
    const { line, places } = latest.current;
    const pts = [...line.map((p) => ({ lng: p[0], lat: p[1] })), ...places.flatMap((p) => (p.lat === null || p.lng === null ? [] : [{ lat: p.lat, lng: p.lng }]))];
    const b = boundsOf(pts);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
  }

  function fitLeg(id: string | null) {
    const map = mapRef.current;
    const pair = pairs.find((p) => pairId(p) === id);
    if (!map || !pair) return;
    const leg = legOf(latest.current.legs, pair.from.key, pair.to.key);
    const b = boundsOf([...(leg?.points ?? []).map((p) => ({ lng: p[0], lat: p[1] })), { lat: pair.from.lat, lng: pair.from.lng }, { lat: pair.to.lat, lng: pair.to.lng }]);
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 16, duration: 400 });
  }

  function pickLeg(id: string) {
    setActiveId(id || null);
    props.onSelectPlace(null);
    if (id) fitLeg(id);
  }

  function chooseBase(next: EditorBase) {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, visibility] of Object.entries(editorBaseVisibility(next))) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    setBase(next);
  }

  function toggleTerrain() {
    const map = mapRef.current;
    if (!map || !map.getLayer(terrainLayerId)) return;
    const next = !terrain;
    map.setLayoutProperty(terrainLayerId, "visibility", next ? "visible" : "none");
    setTerrain(next);
  }

  async function readGpx(file: File | undefined) {
    if (!file) return;
    setNote(null);
    setWaypoints(null);
    if (file.size > 20_000_000) return setNote(t`ファイルが大きすぎます（20MBまで）。`);
    const parsed = parseGpx(await file.text());
    if (!parsed.ok) return setNote(t`GPXファイルを読み込めませんでした。道すじ（トラック）か、名前のついた地点が入ったファイルを選んでください。`);
    if (parsed.points.length >= 2) {
      props.onLine(simplify(parsed.points, MAX_POINTS));
      setTimeout(fit, 100);
      setNote(
        pairs.length >= 1
          ? t`GPXファイルを読み込み、経由地ごとの区間に分けました（最初の経由地より前と、最後の経由地より後は入りません）。形を確かめてから、保存してください。`
          : t`GPXファイルを読み込みました。経由地を2つ以上置くと、経由地ごとの区間に分かれます。`,
      );
    }
    if (parsed.waypoints.length > 0) {
      setWaypoints(parsed.waypoints);
      if (parsed.points.length < 2) setNote(t`GPXファイルに道すじはありませんでした。名前のついた地点だけ見つかりました。`);
    }
  }

  /** Only the heights of a GPX track are taken, and put on the line as it is drawn. */
  async function heightsFromGpx(file: File | undefined) {
    if (!file) return;
    setNote(null);
    if (file.size > 20_000_000) return setNote(t`ファイルが大きすぎます（20MBまで）。`);
    const parsed = parseGpx(await file.text());
    if (!parsed.ok || parsed.points.length < 2) return setNote(t`GPXファイルを読み込めませんでした。道すじ（トラック）の入ったファイルを選んでください。`);
    const r = applyGpxElevations(props.line, parsed.points);
    if (!r) return setNote(t`このGPXファイルには、標高のある道すじがないか、今の線とほとんど重なっていません。`);
    props.onHeights(r.points);
    const total = props.line.length;
    const matched = r.matched;
    setNote(t`標高を入れました。線の${total}点のうち、${matched}点がGPXの道すじに重なっていました（ほかの点は、前後の高さから補いました）。線の形は変えていません。保存してください。`);
  }

  /** The legs to work on: the chosen one; or, with none chosen, every leg that `all` accepts. */
  const targets = (all: (pair: { from: Stop; to: Stop }) => boolean) => (activePair ? [activePair] : pairs.filter(all));

  // Finds the way along trails (or a straight hop) for each leg to work on; the ends are the stops exactly.
  async function connect(kind: "trail" | "direct") {
    const list = targets((p) => !legOf(props.legs, p.from.key, p.to.key));
    if (pairs.length === 0) return setNote(t`先に、経由地を2つ以上置いてください（寄り道は数えません）。`);
    if (list.length === 0) return setNote(t`線のない区間はありません。区間を選ぶと、その区間をつくり直せます。`);
    setWorking(true);
    setNote(t`道を調べています…`);
    const count = list.length;
    const built: Leg[] = [];
    let straight = 0;
    for (const { from, to } of list) {
      const r = await buildLine([{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], kind);
      straight += r.straightHops;
      built.push({ from: from.key, to: to.key, points: withEnds(r.line, from, to) });
    }
    setWorking(false);
    setLegs([...props.legs.filter((l) => !built.some((b) => b.from === l.from && b.to === l.to)), ...built]);
    setTimeout(() => (activePair ? fitLeg(pairId(activePair)) : fit()), 100);
    setNote(
      kind === "direct"
        ? t`${count}つの区間を、まっすぐにつなぎました。形を確かめてから、保存してください。`
        : straight === 0
          ? t`${count}つの区間を、道に沿ってつなぎました。形を確かめてから、保存してください。「元に戻す」で、もとにもどせます。`
          : t`${count}つの区間を、道に沿ってつなぎました。${straight}か所は道が見つからず、まっすぐです。形を確かめてから、保存してください。`,
    );
  }

  // Joins the drawn legs (or the stops, for a leg that has none) along real walking trails. The route-finding service is asked
  // first; when it is not set up or does not answer, GSI's own trail map does the same job without a key (as Navivi falls back).
  async function snapToTrails() {
    const list = targets(() => true);
    if (list.length === 0) return setNote(t`先に、経由地を2つ以上置いてください（寄り道は数えません）。`);
    setWorking(true);
    let useService = true;
    let lastMessage = "";
    let allStraight = true;
    const made: Leg[] = [];
    for (const [n, { from, to }] of list.entries()) {
      const step = n + 1;
      const total = list.length;
      setNote(t`道を調べています…（${step}/${total}）`);
      const leg = legOf(props.legs, from.key, to.key);
      // A leg with guide points is found again through them; otherwise the drawn shape is followed.
      const points: SnapPoint[] = leg?.via?.length ? guideRoute(from, to, leg.via) : leg ? simplify(leg.points, 25).map((p) => ({ lat: p[1], lng: p[0] })) : [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];
      let line: LngLatEle[] | null = null;
      if (useService) {
        const result = await props.onSnap(points);
        if (result.ok) {
          line = await closeLineGaps(result.line, points);
          allStraight = false;
        } else {
          useService = false;
          lastMessage = result.message;
        }
      }
      if (!line) {
        const built = await buildLine(points, "trail");
        if (built.straightHops < points.length - 1) allStraight = false;
        line = built.line;
      }
      made.push({ from: from.key, to: to.key, points: withEnds(simplify(roundLine(line), MAX_POINTS), from, to), ...(leg?.ride ? { ride: leg.ride } : {}), ...(leg?.via ? { via: leg.via } : {}), ...(leg?.side ? { side: true as const } : {}) });
    }
    setWorking(false);
    if (allStraight) return setNote(lastMessage || t`道が見つかりませんでした。`);
    setLegs([...props.legs.filter((l) => !made.some((b) => b.from === l.from && b.to === l.to)), ...made]);
    setTimeout(() => (activePair ? fitLeg(pairId(activePair)) : fit()), 100);
    setNote(
      useService
        ? t`線を道に沿わせました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。`
        : t`道の探索サービスが使えなかったため、地図の道（国土地理院）で探しました。いつもと違う道になることがあります。形をよく確かめてください。「元に戻す」で、もとの線にもどせます。`,
    );
  }

  // Rounds the corners of a leg (Navivi's smooth anchors): fewer, smoother bends.
  function smooth() {
    const list = targets((p) => !!legOf(props.legs, p.from.key, p.to.key));
    const have = list.flatMap((p) => {
      const leg = legOf(props.legs, p.from.key, p.to.key);
      return leg && leg.points.length >= 3 ? [{ p, leg }] : [];
    });
    if (have.length === 0) return setNote(t`先に、線を描いてください。`);
    setLegs([
      ...props.legs.filter((l) => !have.some(({ leg }) => leg === l)),
      ...have.map(({ p, leg }): Leg => ({ from: leg.from, to: leg.to, points: withEnds(simplify(smoothLine(leg.points), MAX_POINTS), p.from, p.to), ...(leg.ride ? { ride: leg.ride } : {}), ...(leg.via ? { via: leg.via } : {}), ...(leg.side ? { side: true as const } : {}) })),
    ]);
    setNote(t`線の角をなめらかにしました。形を確かめてください。「元に戻す」で、もとの線にもどせます。`);
  }

  function clearLine() {
    if (activePair) props.onClearLeg(activePair.from.key, activePair.to.key);
    else props.onClearLegs();
    setAnchorIdx(null);
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setFound(null);
    const hits = await searchPlaces(query);
    setSearching(false);
    if (hits === null) return setNote(t`場所を探すサービスにつながりませんでした。しばらくしてから、もう一度お試しください。`);
    if (hits.length === 0) return setNote(t`その名前の場所は見つかりませんでした。`);
    setNote(null);
    setFound(hits);
  }

  function showHit(hit: PlaceHit) {
    mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 15, duration: 600 });
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be chosen again
    void readGpx(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropping(false);
    void readGpx(e.dataTransfer.files[0]);
  }

  function addWaypoints() {
    if (!waypoints) return;
    props.onAddPlaces(waypoints.map((w) => ({ key: crypto.randomUUID(), name: w.name, lat: w.lat, lng: w.lng })));
    setNote(t`${waypoints.length}か所を、経由地として追加しました。名前や種類は「経由地」で直せます。`);
    setWaypoints(null);
  }

  const toolButton = (tool: "select" | "place" | "draw" | "guide", label: string, shortcut: string, icon: ReactNode) => {
    const pressed = tool === "select" ? mode === "pan" : mode === tool;
    return (
      <button
        key={tool}
        type="button"
        aria-pressed={pressed}
        aria-keyshortcuts={shortcut}
        title={`${label} (${shortcut})`}
        onClick={() => actions.current.chooseTool(tool)}
        className={`${iconBtn} justify-start px-1.5 text-xs sm:px-2 sm:text-sm ${pressed ? "bg-ink text-paper hover:bg-ink" : "text-ink"}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  const legLabel = (pair: { from: Stop; to: Stop; side?: true; back?: true }) => `${pair.side ? t`【サブコース】` : pair.back ? t`【戻り】` : ""}${nameOf.get(pair.from.key) ?? ""} → ${nameOf.get(pair.to.key) ?? ""}`;
  const rideName: Record<RideMode, string> = { ferry: t`船`, bus: t`バス`, train: t`電車`, other: t`ほかの乗り物` };
  /** Walk, or ride (a ferry from a port ...) for this long: the leg is made (straight) when it has no line yet. */
  function setRide(mode: RideMode | "walk", minutes: number) {
    if (!activePair) return;
    const base: Leg = activeLeg ?? { from: activePair.from.key, to: activePair.to.key, points: [[activePair.from.lng, activePair.from.lat], [activePair.to.lng, activePair.to.lat]] };
    const plain: Leg = { ...base, ride: undefined }; // (an undefined member is not saved)
    setLeg(mode === "walk" ? plain : { ...plain, ride: { mode, minutes: Math.min(1440, Math.max(1, Math.round(minutes))) } });
  }
  // How long the leg takes to walk (from its line, and its climb once the heights are filled in): " · 25 min (1.2 km)".
  const timeText = (pair: { from: Stop; to: Stop }) => {
    const leg = legOf(props.legs, pair.from.key, pair.to.key);
    if (leg?.ride) {
      const [mode, minutes] = [rideName[leg.ride.mode], leg.ride.minutes];
      return ` · ${t`${mode} ${minutes}分`}`;
    }
    const time = leg ? legTime(leg.points) : null;
    if (!time) return "";
    const [minutes, km] = [time.minutes, time.km];
    return ` · ${t`${minutes}分（${km} km）`}`;
  };
  const activeName = activePair ? legLabel(activePair) + timeText(activePair) : null;
  const canWork = !working && pairs.length > 0;
  // A saved line that the waypoints do not follow (a stop twice, or in another order) is kept as it is, not cut into legs.
  const looseLine = props.legs.length === 0 && props.line.length >= 2 && pairs.length > 0;
  const legName = activeName ?? "";
  const chosenNo = (anchorIdx ?? 0) + 1;
  const pointCount = activePath.anchors.length;
  const guideCount = activeLeg?.via?.length ?? 0;

  // What to do next, depending on the tool and on what is already on the map.
  const hasLine = props.line.length >= 2;
  const hasPlaces = props.places.length > 0;
  const selectedSide = props.places.some((p) => p.key === props.selectedKey && p.stopBy);
  const afterName = insertAfter ? (nameOf.get(insertAfter) ?? "") : "";
  const locatingName = locating ? nameOf.get(locating) ?? "" : "";
  const hint = locating
    ? t`地図をクリックすると、「${locatingName}」の位置を決めます。やめるには、もう一度ボタンを押すか、Escキーを押します。`
    : looseLine
    ? t`この線は、経由地の順番や位置と合わないため、区間に分けていません。経由地の順番と位置を直してから「区間に分ける」を押すか、区間を描くと、その区間から線が置き換わります（「元に戻す」で戻せます）。`
    : mode === "place"
      ? insertAfter
        ? t`地図をクリックすると、「${afterName}」のすぐ次に経由地を置きます。`
        : t`地図をクリックすると、その位置に経由地を置きます。`
      : mode === "guide"
        ? !activePair
          ? t`ガイド点を置きたい区間（経由地と経由地のあいだ）を選んでください。`
          : t`地図をクリックすると、道を探すときの目印（ガイド点）を置きます。ガイド点は、訪れる人には見えません。点はドラッグで動かせ、クリックで消えます。置いたり動かしたりしても、道は探しません。並べ終わったら「道を探す」を押してください（探すのは1回だけです）。`
      : mode === "draw"
        ? !activePair
          ? t`描きたい区間（経由地と経由地のあいだ）を選んでください。`
          : eraser
            ? t`消したい点をクリックします。`
            : anchorIdx !== null
              ? t`新しい点は、選んだ点（${chosenNo}番）のあとに入ります。もう一度クリックすると、選びなおせます。`
              : t`地図をクリックして、この区間に点を置いていきます。点はドラッグで動かせます。ダブルクリックで、なめらかな点と角の点が切り替わります。`
        : selectedSide && activePair
          ? t`寄り道の点を選んでいます。サブコースの線（${legName}）は、右の一覧の「サブコースの線を描く」か、「線を描く」で描けます。本線の点をクリックする必要はありません。`
        : activePair
          ? t`「${legName}」を選んでいます。この区間の点をドラッグして動かせます。地図の何もない所をクリックすると、選びなおせます。`
          : hasLine
            ? t`線をクリックすると、その区間を選べます。数字の丸をドラッグすると、経由地を動かせます。`
            : hasPlaces
              ? t`数字の丸をドラッグすると、経由地を動かせます。道すじは「線を描く」か、GPXファイルで入れます。`
              : t`まず、GPXファイルをここにドラッグするか「GPXファイルから読み込む」を押してください。手で入れるときは「経由地を置く」で経由地を入れ、「線を描く」で区間ごとに道すじを描きます。`;

  return (
    // From 1280 px the waypoint list sits beside the map (and scrolls on its own); below that it is under it.
    <div className={`flex flex-col gap-3 ${props.places.length > 0 ? "xl:grid xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start xl:gap-x-5" : ""}`}>
      <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t`道すじ`}>
        {/* One button for the GPX file; its arrow offers the other thing to do with one (take only the heights). */}
        <div className="relative inline-flex">
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex h-11 min-h-0 min-w-0 items-center justify-center rounded-l-lg border border-line bg-ink px-3 text-sm font-bold text-paper">
            {t`GPXファイルから読み込む`}
          </button>
          <button
            type="button"
            aria-label={t`GPXの読み込みかた`}
            aria-haspopup="menu"
            aria-expanded={gpxMenu}
            onClick={() => setGpxMenu((v) => !v)}
            className="inline-flex h-11 min-h-0 min-w-0 items-center justify-center rounded-r-lg border border-l-paper/40 border-ink bg-ink px-2 text-sm font-bold text-paper"
          >
            ▾
          </button>
          {gpxMenu ? (
            <div role="menu" className="absolute left-0 top-full z-30 mt-1 flex min-w-64 flex-col rounded-full border border-line bg-paper p-1 shadow-lg">
              <button type="button" role="menuitem" onClick={() => { setGpxMenu(false); fileInput.current?.click(); }} className="rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-surface">
                {t`線と標高を読み込む`}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!hasLine}
                onClick={() => { setGpxMenu(false); heightsInput.current?.click(); }}
                className="rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-surface disabled:opacity-50"
                title={t`GPXファイルから標高だけを取り出して、今の線に入れます（線の形は変わりません）`}
              >
                {t`標高だけ取り込む（線は変えない）`}
              </button>
            </div>
          ) : null}
        </div>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml,text/xml,application/xml" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <span className="text-sm text-muted">{activePair ? t`選んだ区間に` : t`すべての区間（線のない所）に`}</span>
        <div className="grid basis-full grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" disabled={!canWork} onClick={() => void connect("trail")} className={`${chipClass} w-full`} title={t`経由地のあいだを、地図の道でつなぎます（寄り道は通りません）`}>
          {working ? t`調べています…` : t`道でつなぐ`}
        </button>
        <button type="button" disabled={!canWork} onClick={() => void connect("direct")} className={`${chipClass} w-full`} title={t`経由地のあいだを、まっすぐな線でつなぎます`}>
          {t`まっすぐつなぐ`}
        </button>
        <button type="button" disabled={!canWork} onClick={() => void snapToTrails()} className={`${chipClass} w-full`} title={t`描いた線を、地図の道に沿わせます`}>
          {t`道に沿わせる`}
        </button>
        <button type="button" disabled={!canWork || !hasLine} onClick={smooth} className={`${chipClass} w-full`} title={t`線の角を、丸くなめらかにします`}>
          {t`なめらかにする`}
        </button>
        <input
          ref={heightsInput}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml,application/xml"
          onChange={(e) => {
            void heightsFromGpx(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        {looseLine ? (
          <button type="button" onClick={props.onSplitLine} className={`${chipClass} w-full`} title={t`今ある線を、経由地の順に区間へ切り分けます（経由地が線と合わないと、まっすぐな部分ができます）`}>
            {t`区間に分ける`}
          </button>
        ) : null}
        </div>
      </div>

      {activePair ? (
        <div role="group" aria-label={t`選んだ区間`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="min-w-0 flex-1 basis-60 truncate text-sm font-bold" title={legName} aria-live="polite">
            {t`選んだ区間：${legName}`}
          </span>
          {activePair && !activePair.side ? (
          <span className="flex items-center gap-1" role="group" aria-label={t`この区間の移動`}>
            <select
              aria-label={t`移動の手段`}
              value={activeLeg?.ride?.mode ?? "walk"}
              onChange={(e) => setRide(e.target.value as RideMode | "walk", activeLeg?.ride?.minutes ?? 20)}
              className="h-11 min-h-0 rounded-full border border-line bg-paper px-2 text-sm font-bold"
            >
              <option value="walk">{t`歩く`}</option>
              {RIDE_MODES.map((m) => (
                <option key={m} value={m}>
                  {rideName[m]}
                </option>
              ))}
            </select>
            {activeLeg?.ride ? (
              <>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  aria-label={t`かかる時間（分）`}
                  value={activeLeg.ride.minutes}
                  onChange={(e) => setRide(activeLeg.ride!.mode, Number(e.target.value) || 1)}
                  className="h-11 min-h-0 w-20 rounded-full border border-line bg-paper px-2 text-sm font-bold"
                />
                <span className="text-sm">{t`分`}</span>
              </>
            ) : null}
          </span>
        ) : null}
          <button type="button" onClick={() => setActiveId(null)} className={chipClass} title={t`区間の選択をやめて、全体を対象にします`}>
            {t`選択をやめる`}
          </button>
        </div>
      ) : null}

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor="map-search" className="sr-only">
          {t`場所の名前で探す`}
        </label>
        <input
          id="map-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t`場所の名前で探す（例：西念寺）`}
          className="tap-target min-w-0 basis-40 flex-1 rounded-full border border-line bg-paper px-4 text-lg"
        />
        <button type="submit" disabled={searching || !query.trim()} className={`${toolClass} border-line bg-paper`}>
          {searching ? t`探しています…` : t`探す`}
        </button>
      </form>
      {found ? (
        <ul aria-label={t`見つかった場所`} className="flex flex-col gap-1 rounded-xl border border-line bg-paper p-2">
          {found.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 p-1">
              <span className="min-w-0 flex-1 break-words text-base">{h.name}</span>
              <button type="button" onClick={() => showHit(h)} className={`${toolClass} border-line bg-paper`}>
                {t`地図を動かす`}
              </button>
              <button type="button" onClick={() => props.onAddPlace(h.lat, h.lng)} className={`${toolClass} border-line bg-paper`}>
                {t`ここに経由地を置く`}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setFound(null)} className="tap-target px-2 text-base font-bold underline underline-offset-4">
              {t`閉じる`}
            </button>
          </li>
        </ul>
      ) : null}

      <p className="text-sm text-muted" aria-live="polite">
        {note ?? hint}
      </p>

      {waypoints ? (
        <div role="group" aria-label={t`GPXの地点`} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
          <p className="text-lg font-bold">{t`名前のついた地点が${waypoints.length}か所ありました。経由地として追加しますか？`}</p>
          <ul className="max-h-40 list-disc overflow-auto pl-6 text-base">
            {waypoints.map((w, i) => (
              <li key={i}>{w.name || t`（名前なし）`}</li>
            ))}
          </ul>
          <p className="text-base text-muted">{t`位置は「確認していない」状態で入ります。公開する前に、公式の情報で確かめてください。`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={addWaypoints} className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper">
              {t`追加する`}
            </button>
            <button type="button" onClick={() => setWaypoints(null)} className="tap-target rounded-full border border-line px-6 text-lg font-bold">
              {t`追加しない`}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="relative h-[34rem] overflow-hidden rounded-2xl bg-surface xl:h-[42rem]"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropping(true);
          }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        <div ref={container} className="h-full w-full" />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
          <div role="toolbar" aria-label={t`地図の道具`} className={`${floatClass} grid max-w-[calc(100%-4.5rem)] grid-cols-[repeat(2,max-content)] sm:flex sm:flex-wrap`}>
            {toolButton("select", t`選ぶ・動かす`, "V", <CursorIcon />)}
            {toolButton("place", t`経由地を置く`, "P", <PinIcon />)}
            {toolButton("draw", t`線を描く`, "L", <PencilIcon />)}
            {toolButton("guide", t`ガイド点`, "G", <GuideIcon />)}
          </div>
          {mode === "draw" || mode === "guide" ? (
            <div role="group" aria-label={mode === "guide" ? t`ガイド点を置く` : t`区間を描く`} className={`${floatClass} max-w-[calc(100vw-6rem)] flex-wrap`}>
              <label htmlFor="leg-pick" className="sr-only">
                {t`描く区間`}
              </label>
              <select id="leg-pick" value={activeId ?? ""} onChange={(e) => pickLeg(e.target.value)} className="h-11 min-h-0 max-w-64 truncate rounded-full border border-line bg-paper px-2 text-sm font-bold">
                <option value="">{t`区間を選ぶ`}</option>
                {pairs.map((pair) => (
                  <option key={pairId(pair)} value={pairId(pair)}>
                    {`${legOf(props.legs, pair.from.key, pair.to.key) ? "● " : "○ "}${legLabel(pair)}${timeText(pair)}`}
                  </option>
                ))}
              </select>
              {activePair && mode === "guide" ? (
                <>
                  <span className="px-1 text-sm tabular-nums">{t`ガイド点 ${guideCount}`}</span>
                  <button type="button" disabled={working || guideCount === 0} onClick={() => void routeThroughGuides(activeLeg?.via ?? [])} className={`${iconBtn} bg-ink text-paper hover:bg-ink`} title={t`いまのガイド点を通る道を、1回だけ探します`}>
                    {working ? t`探しています…` : t`道を探す`}
                  </button>
                  <button type="button" disabled={working || guideCount === 0} onClick={() => changeGuides([])} className={`${iconBtn} text-danger`} title={t`ガイド点をすべて消します（線はそのままです）`}>
                    {t`すべて消す`}
                  </button>
                  <button type="button" onClick={() => fitLeg(activeId)} className={iconBtn} title={t`この区間を見る`} aria-label={t`この区間を見る`}>
                    <FitIcon />
                  </button>
                </>
              ) : null}
              {activePair && mode === "draw" ? (
                <>
                  <div className="flex items-center rounded-lg bg-surface p-0.5" role="group" aria-label={t`点の操作`}>
                    <button type="button" aria-pressed={!eraser} onClick={() => setEraser(false)} className={`${iconBtn} ${!eraser ? "bg-paper shadow-sm" : "text-muted"}`}>
                      {t`点を置く`}
                    </button>
                    <button type="button" aria-pressed={eraser} aria-keyshortcuts="E" title={t`点を消す (E)`} onClick={() => setEraser(true)} className={`${iconBtn} ${eraser ? "bg-paper text-danger shadow-sm" : "text-muted"}`}>
                      {t`点を消す`}
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isAllSmooth(activePath.curves)}
                    onClick={() => editPath((p) => setAllCurves(p, !isAllSmooth(p.curves)))}
                    disabled={activePath.anchors.length === 0}
                    title={t`すべての点を、なめらかな点にします（もう一度押すと、角の点に戻ります）`}
                    className={`${iconBtn} ${isAllSmooth(activePath.curves) ? "bg-ink text-paper hover:bg-ink" : ""}`}
                  >
                    {t`すべてなめらか`}
                  </button>
                  <span className="px-1 text-sm tabular-nums">{t`点 ${pointCount}`}</span>
                  <button type="button" onClick={() => fitLeg(activeId)} className={iconBtn} title={t`この区間を見る`} aria-label={t`この区間を見る`}>
                    <FitIcon />
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => actions.current.leaveDraw()} className={`${iconBtn} bg-ink text-paper hover:bg-ink`}>
                {t`完了`}
              </button>
            </div>
          ) : null}
        </div>
        <div className="absolute bottom-8 left-3 flex flex-wrap gap-2">
          <div className={floatClass} role="group" aria-label={t`やり直し`}>
            <button type="button" disabled={!props.canUndo} onClick={props.onUndo} className={iconBtn} title={t`元に戻す`} aria-label={t`元に戻す`}>
              <UndoIcon />
            </button>
            <button type="button" disabled={!props.canRedo} onClick={props.onRedo} className={iconBtn} title={t`やり直す`} aria-label={t`やり直す`}>
              <RedoIcon />
            </button>
            <button type="button" disabled={props.line.length === 0 && !activeLeg} onClick={clearLine} className={`${iconBtn} text-danger`} title={activePair ? t`選んだ区間の線を消す` : t`線をすべて消す`} aria-label={activePair ? t`選んだ区間の線を消す` : t`線をすべて消す`}>
              <TrashIcon />
            </button>
          </div>
          <div className={floatClass} role="group" aria-label={t`地図の種類`}>
            {editorBases.map((b) => (
              <button key={b} type="button" aria-pressed={base === b} onClick={() => chooseBase(b)} className={`${iconBtn} ${base === b ? "bg-ink text-paper hover:bg-ink" : ""}`}>
                {b === "std" ? t`標準` : b === "pale" ? t`淡色` : b === "photo" ? t`写真` : t`アウトドア`}
              </button>
            ))}
          </div>
          <div className={floatClass} role="group" aria-label={t`見え方`}>
            <button type="button" onClick={fit} className={iconBtn} title={t`全体を見る`} aria-label={t`全体を見る`}>
              <FitIcon />
            </button>
            <button type="button" aria-pressed={terrain} onClick={toggleTerrain} className={`${iconBtn} ${terrain ? "bg-ink text-paper hover:bg-ink" : ""}`} title={t`地形の陰影`} aria-label={t`地形の陰影`}>
              <TerrainIcon />
            </button>
          </div>
        </div>
        {dropping ? <p className="absolute inset-0 flex items-center justify-center bg-paper/80 text-xl font-bold">{t`GPXファイルをここで離すと、読み込みます`}</p> : null}
        {!ready ? <p className="absolute inset-0 flex items-center justify-center text-lg">{t`地図を読み込み中…`}</p> : null}
      </div>

      <p className="text-lg font-bold tabular-nums">
        {props.line.length >= 2 ? t`線の長さ ${props.distanceKm ?? 0} km` : t`線は、まだありません。`}
        {props.climbM !== null && props.line.length >= 2 ? <span className="ml-4">{t`登り ${props.climbM} m`}</span> : null}
        {props.elevationStatus === "loading" ? <span className="ml-4 text-base font-normal text-muted">{t`標高を調べています…`}</span> : null}
        {props.elevationStatus === "partial" ? <span className="ml-4 text-base font-normal text-muted">{t`標高が調べられない場所があります。`}</span> : null}
      </p>

      </div>
      {props.places.length > 0 ? <PlaceList
          {...props}
          insertAfter={insertAfter}
          back={{
            legs: pairs.filter((p) => p.back).map((p) => ({ from: p.from.key, to: p.to.key })),
            options: backChoices(stops, props.legs).options.map((st) => st.key),
            onAdd: (toKey) => {
              const { end, options } = backChoices(stops, props.legs);
              const to = options.find((st) => st.key === toKey);
              if (!end || !to) return;
              setLeg(backLeg(end, to));
              setActiveId(pairId({ from: end, to, back: true }));
              setAfterOff(false);
              setNote(null);
              setMode("draw");
            },
            onRemoveLast: () => {
              const last = pairs.filter((p) => p.back).at(-1);
              if (last) props.onClearLeg(last.from.key, last.to.key);
            },
            onDraw: (index) => {
              const pair = pairs.filter((p) => p.back)[index];
              if (!pair) return;
              setActiveId(pairId(pair));
              setAfterOff(false);
              setNote(null);
              setMode("draw");
            },
          }}
          onDrawSubCourse={(key) => {
            props.onSelectPlace(key);
            setActiveId(key); // a side trip's leg is named by the place it runs to
            setAfterOff(false);
            setNote(null);
            setMode("draw");
          }}
          locating={locating}
          onLocate={(key) => setLocating((cur) => (cur === key ? null : key))}
          onInsertAfter={(key) => {
            if (insertAfter === key) return setAfterOff(true);
            props.onSelectPlace(key);
            actions.current.chooseTool("place");
          }}
        /> : null}
    </div>
  );
}

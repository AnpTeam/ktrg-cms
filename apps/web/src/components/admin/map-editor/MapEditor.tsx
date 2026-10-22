"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import { isAllSmooth } from "@/lib/admin/drawn-path";
import { parseGpx, type GpxWaypoint } from "@/lib/admin/gpx";
import { LEG_HIT, LEG_SOURCE, legFeatures, legLayers } from "@/lib/admin/leg-map";
import { guideRoute, insertAnchor, insertGuidePoint, legFromPath, legOf, MAX_GUIDE_POINTS, moveAnchor, moveGuidePoint, pairsOf, pathOfLeg, pathStops, pointsFromAnchors, removeAnchors, removeGuidePoint, RIDE_MODES, setAllCurves, sidePairs, toggleAnchorCurve, type GuidePoint, type Leg, type Path, type RideMode, type Stop } from "@/lib/admin/legs";
import { simplify, type LngLatEle } from "@/lib/admin/line";
import { legTime } from "@/lib/leg-times";
import { searchPlaces, type PlaceHit } from "@/lib/admin/place-search";
import { buildLine, closeLineGaps, smoothLine } from "@/lib/admin/route-builder";
import { roundLine, type SnapPoint } from "@/lib/admin/snap";
import { boundsOf, editorBaseVisibility, editorBases, editorStyle, terrainLayerId, zoomLimits, type EditorBase } from "@/lib/map";
import { pointKinds, type PointKind } from "@/lib/point-kinds";
import { useKindLabels } from "../PlacePanel";

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
  /** Cut the loose line into legs at the stops even though they do not follow it. */
  onSplitLine: () => void;
  onAddPlace: (lat: number, lng: number) => void;
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
const markerClass =
  "flex size-10 min-h-0 min-w-0 p-0 items-center justify-center rounded-full border-2 border-paper bg-brand text-lg font-bold text-on-brand shadow-md data-[published=true]:border-moss data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[stopby=true]:border-dashed data-[unplaced=true]:opacity-60";
const dotClass =
  "flex size-7 min-h-0 min-w-0 p-0 items-center justify-center rounded-full border-2 border-ink bg-paper text-sm font-bold text-ink shadow-md data-[published=true]:border-moss data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[stopby=true]:border-dashed data-[unplaced=true]:opacity-60";
// A point of the chosen leg (Navivi's anchor): a square is a sharp corner, a circle is a smooth bend.
const anchorClass =
  "block size-3.5 min-h-0 min-w-0 cursor-grab rounded-[3px] border-2 border-white bg-ink p-0 shadow-md active:cursor-grabbing data-[smooth=true]:size-4 data-[smooth=true]:rounded-full data-[selected=true]:bg-brand data-[selected=true]:ring-2 data-[selected=true]:ring-ink";
// A guide point of the chosen leg: a dashed orange ring. Visitors never see it; it only steers the route-finding service.
const guideClass =
  "block size-4 min-h-0 min-w-0 cursor-grab rounded-full border-[3px] border-dashed border-[var(--color-goal)] bg-paper p-0 shadow-md active:cursor-grabbing";
const chipClass = "inline-flex h-9 min-h-0 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-sm font-bold hover:bg-surface disabled:opacity-40 disabled:hover:bg-paper";
const floatClass = "flex items-center gap-0.5 rounded-xl border border-line bg-paper/95 p-1 shadow-md backdrop-blur-sm";
const iconBtn = "inline-flex h-8 min-h-0 min-w-8 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold [&:not([aria-pressed=true])]:hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent";
const toolClass = "tap-target inline-flex items-center justify-center rounded-xl border-2 px-3 text-base font-bold disabled:opacity-40";

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

type Pair = { from: Stop; to: Stop; side?: true };

/** The leg of a chosen waypoint: the one that starts there, or the side trip that leads to it. */
const legOfWaypoint = (pairs: readonly Pair[], key: string | null): Pair | undefined =>
  pairs.find((p) => !p.side && p.from.key === key) ?? pairs.find((p) => p.side && p.to.key === key);

/** The leg to start drawing: the one of the chosen waypoint, else the first pair without a leg, else the first pair. */
function firstLeg(pairs: readonly Pair[], legs: readonly Leg[], selectedKey: string | null): string | null {
  const own = legOfWaypoint(pairs, selectedKey);
  const empty = pairs.find((p) => !legOf(legs, p.from.key, p.to.key));
  return (own ?? empty ?? pairs[0])?.to.key ?? null;
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

  const container = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
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
  const pairs: Pair[] = useMemo(() => [...pairsOf(stops), ...sidePairs(props.places).map((p) => ({ ...p, side: true as const }))], [stops, props.places]);
  // The chosen leg is read as nothing once its pair of stops is gone, and the chosen point only counts on the leg it was chosen on.
  const activePair = pairs.find((p) => p.to.key === chosenId) ?? null;
  const activeId = activePair ? activePair.to.key : null;
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
    props.onSetLeg({ ...legFromPath(activePair.from, activePair.to, next), ...(activeLeg?.ride ? { ride: activeLeg.ride } : {}), ...(activeLeg?.via ? { via: activeLeg.via } : {}) });
  }

  /**
   * Finds the way of the chosen leg again through these guide points (Navivi's via points): the route-finding service is given the
   * two stops with the guide points between them, so it cannot pick a shorter but worse way. The guide points stay on the leg for
   * the next time. When no way is found the guide points are kept and the line is left as it was.
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
    const result = await props.onSnap(points);
    if (result.ok) line = await closeLineGaps(result.line, points);
    else {
      message = result.message;
      // The service is not set up or did not answer: GSI's own trail map does the same job without a key.
      const built = await buildLine(points, "trail");
      if (built.straightHops < points.length - 1) line = built.line;
    }
    setWorking(false);
    if (!line) {
      props.onSetLeg({ from: from.key, to: to.key, points: own?.points ?? [[from.lng, from.lat], [to.lng, to.lat]], ...keep });
      return setNote(message || t`道が見つかりませんでした。ガイド点は残してあります。`);
    }
    props.onSetLeg({ from: from.key, to: to.key, points: withEnds(simplify(roundLine(line), MAX_POINTS), from, to), ...keep });
    setNote(via.length > 0 ? t`ガイド点を通るように、道を引きなおしました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。` : t`ガイド点をなくして、道を引きなおしました。形を確かめてから、保存してください。`);
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
      if (m === "place") return latest.current.onAddPlace(e.lngLat.lat, e.lngLat.lng);
      if (m === "guide") {
        if (!activePair) return;
        const cur = activeLeg?.via ?? [];
        if (cur.length >= MAX_GUIDE_POINTS) return setNote(t`ガイド点は、1つの区間に${MAX_GUIDE_POINTS}個までです。`);
        void routeThroughGuides(insertGuidePoint(activePair.from, activePair.to, cur, [e.lngLat.lng, e.lngLat.lat]));
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
    // In the guide tool a guide point is removed by clicking it, or moved by dragging it; either finds the way again.
    clickGuide: (i) => {
      if (justDragged.current || modeRef.current !== "guide") return;
      void routeThroughGuides(removeGuidePoint(activeLeg?.via ?? [], i));
    },
    dropGuide: (i, at) => {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 250);
      void routeThroughGuides(moveGuidePoint(activeLeg?.via ?? [], i, [at.lng, at.lat]));
    },
    previewAnchor: (i, at) => {
      if (!activePair) return;
      const moved = moveAnchor(activePath, i, [at.lat, at.lng]);
      actions.current.redraw({ id: activePair.to.key, points: pointsFromAnchors(activePair.from, activePair.to, moved.anchors, moved.curves) });
    },
    dropAnchor: (i, at) => {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 250);
      editPath((p) => moveAnchor(p, i, [at.lat, at.lng]));
    },
    chooseTool: (tool) => {
      setNote(null);
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
    if (own) setActiveId(own.to.key);
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
    map.getCanvas().style.cursor = mode === "place" || ((mode === "draw" || mode === "guide") && activePair) ? "crosshair" : "";
    for (const { marker } of markers.current.values()) marker.setDraggable(mode === "pan" || mode === "place");
  }, [mode, ready, activePair]);

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
      let entry = markers.current.get(p.key);
      if (!entry) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = markerClass;
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          latest.current.onSelectPlace(p.key);
        });
        const marker = new ml.Marker({ element: el, draggable: modeRef.current === "pan" || modeRef.current === "place" }).setLngLat([p.lng!, p.lat!]).addTo(map);
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          latest.current.onMovePlace(p.key, lat, lng);
        });
        entry = { marker, el };
        markers.current.set(p.key, entry);
      }
      entry.marker.setLngLat([p.lng!, p.lat!]);
      // Add and remove only our own classes: MapLibre keeps `maplibregl-marker` (position: absolute) on the element, and
      // replacing the whole className dropped it, so markers fell out of place and drifted when the map zoomed.
      entry.el.classList.remove(...(p.stampable ? dotClass : markerClass).split(" "));
      entry.el.classList.add(...(p.stampable ? markerClass : dotClass).split(" "));
      entry.el.textContent = p.stampable ? String(p.number) : "";
      entry.el.dataset.stopby = String(p.stopBy);
      entry.el.dataset.published = String(p.published);
      entry.el.title = p.published ? `${p.name}（公開中）` : p.name;
      entry.el.setAttribute("aria-label", p.stampable ? `${p.number}. ${p.name}` : p.name);
      entry.el.dataset.selected = String(p.key === props.selectedKey);
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
  function fit() {
    const map = mapRef.current;
    if (!map) return;
    const pts = [...props.line.map((p) => ({ lng: p[0], lat: p[1] })), ...props.places.flatMap((p) => (p.lat === null || p.lng === null ? [] : [{ lat: p.lat, lng: p.lng }]))];
    const b = boundsOf(pts);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
  }

  function fitLeg(id: string | null) {
    const map = mapRef.current;
    const pair = pairs.find((p) => p.to.key === id);
    if (!map || !pair) return;
    const leg = legOf(props.legs, pair.from.key, pair.to.key);
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
    props.onSetLegs([...props.legs.filter((l) => !built.some((b) => b.from === l.from && b.to === l.to)), ...built]);
    setTimeout(() => (activePair ? fitLeg(activePair.to.key) : fit()), 100);
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
    props.onSetLegs([...props.legs.filter((l) => !made.some((b) => b.from === l.from && b.to === l.to)), ...made]);
    setTimeout(() => (activePair ? fitLeg(activePair.to.key) : fit()), 100);
    setNote(t`線を道に沿わせました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。`);
  }

  // Rounds the corners of a leg (Navivi's smooth anchors): fewer, smoother bends.
  function smooth() {
    const list = targets((p) => !!legOf(props.legs, p.from.key, p.to.key));
    const have = list.flatMap((p) => {
      const leg = legOf(props.legs, p.from.key, p.to.key);
      return leg && leg.points.length >= 3 ? [{ p, leg }] : [];
    });
    if (have.length === 0) return setNote(t`先に、線を描いてください。`);
    props.onSetLegs([
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
        className={`${iconBtn} ${pressed ? "bg-ink text-paper hover:bg-ink" : "text-ink"}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  const legLabel = (pair: { from: Stop; to: Stop }) => `${nameOf.get(pair.from.key) ?? ""} → ${nameOf.get(pair.to.key) ?? ""}`;
  const rideName: Record<RideMode, string> = { ferry: t`船`, bus: t`バス`, train: t`電車`, other: t`ほかの乗り物` };
  /** Walk, or ride (a ferry from a port ...) for this long: the leg is made (straight) when it has no line yet. */
  function setRide(mode: RideMode | "walk", minutes: number) {
    if (!activePair) return;
    const base: Leg = activeLeg ?? { from: activePair.from.key, to: activePair.to.key, points: [[activePair.from.lng, activePair.from.lat], [activePair.to.lng, activePair.to.lat]] };
    const plain: Leg = { ...base, ride: undefined }; // (an undefined member is not saved)
    props.onSetLeg(mode === "walk" ? plain : { ...plain, ride: { mode, minutes: Math.min(1440, Math.max(1, Math.round(minutes))) } });
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
  const hint = looseLine
    ? t`この線は、経由地の順番や位置と合わないため、区間に分けていません。経由地の順番と位置を直してから「区間に分ける」を押すか、区間を描くと、その区間から線が置き換わります（「元に戻す」で戻せます）。`
    : mode === "place"
      ? t`地図をクリックすると、その位置に経由地を置きます。`
      : mode === "guide"
        ? !activePair
          ? t`ガイド点を置きたい区間（経由地と経由地のあいだ）を選んでください。`
          : t`地図をクリックすると、道を探すときの目印（ガイド点）を置きます。ガイド点は、訪れる人には見えません。置いたり動かしたりするたびに、点を通る道を探しなおします。点をクリックすると消えます。`
      : mode === "draw"
        ? !activePair
          ? t`描きたい区間（経由地と経由地のあいだ）を選んでください。`
          : eraser
            ? t`消したい点をクリックします。`
            : anchorIdx !== null
              ? t`新しい点は、選んだ点（${chosenNo}番）のあとに入ります。もう一度クリックすると、選びなおせます。`
              : t`地図をクリックして、この区間に点を置いていきます。点はドラッグで動かせます。ダブルクリックで、なめらかな点と角の点が切り替わります。`
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
        <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex h-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-ink bg-ink px-3 text-sm font-bold text-paper">
          {t`GPXファイルから読み込む`}
        </button>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml,text/xml,application/xml" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <span className="text-sm text-muted" aria-live="polite">
          {activePair ? t`選んだ区間：${legName}` : t`すべての区間（線のない所）`}
        </span>
        {activePair && !activePair.side ? (
          <span className="flex items-center gap-1" role="group" aria-label={t`この区間の移動`}>
            <select
              aria-label={t`移動の手段`}
              value={activeLeg?.ride?.mode ?? "walk"}
              onChange={(e) => setRide(e.target.value as RideMode | "walk", activeLeg?.ride?.minutes ?? 20)}
              className="h-9 min-h-0 rounded-lg border border-line bg-paper px-2 text-sm font-bold"
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
                  className="h-9 min-h-0 w-20 rounded-lg border border-line bg-paper px-2 text-sm font-bold"
                />
                <span className="text-sm">{t`分`}</span>
              </>
            ) : null}
          </span>
        ) : null}
        <button type="button" disabled={!canWork} onClick={() => void connect("trail")} className={chipClass} title={t`経由地のあいだを、地図の道でつなぎます（寄り道は通りません）`}>
          {working ? t`調べています…` : t`道でつなぐ`}
        </button>
        <button type="button" disabled={!canWork} onClick={() => void connect("direct")} className={chipClass} title={t`経由地のあいだを、まっすぐな線でつなぎます`}>
          {t`まっすぐつなぐ`}
        </button>
        <button type="button" disabled={!canWork} onClick={() => void snapToTrails()} className={chipClass} title={t`描いた線を、地図の道に沿わせます`}>
          {t`道に沿わせる`}
        </button>
        <button type="button" disabled={!canWork || !hasLine} onClick={smooth} className={chipClass} title={t`線の角を、丸くなめらかにします`}>
          {t`なめらかにする`}
        </button>
        {looseLine ? (
          <button type="button" onClick={props.onSplitLine} className={chipClass} title={t`今ある線を、経由地の順に区間へ切り分けます（経由地が線と合わないと、まっすぐな部分ができます）`}>
            {t`区間に分ける`}
          </button>
        ) : null}
        {activePair ? (
          <button type="button" onClick={() => setActiveId(null)} className={chipClass} title={t`区間の選択をやめて、全体を対象にします`}>
            {t`選択をやめる`}
          </button>
        ) : null}
      </div>

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
          className="tap-target min-w-60 flex-1 rounded-xl border-2 border-line bg-paper px-4 text-lg"
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
        <div role="group" aria-label={t`GPXの地点`} className="flex flex-col gap-3 rounded-xl border border-ink bg-paper p-4">
          <p className="text-lg font-bold">{t`名前のついた地点が${waypoints.length}か所ありました。経由地として追加しますか？`}</p>
          <ul className="max-h-40 list-disc overflow-auto pl-6 text-base">
            {waypoints.map((w, i) => (
              <li key={i}>{w.name || t`（名前なし）`}</li>
            ))}
          </ul>
          <p className="text-base text-muted">{t`位置は「確認していない」状態で入ります。公開する前に、公式の情報で確かめてください。`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={addWaypoints} className="tap-target rounded-xl bg-ink px-6 text-lg font-bold text-paper">
              {t`追加する`}
            </button>
            <button type="button" onClick={() => setWaypoints(null)} className="tap-target rounded-xl border-2 border-line px-6 text-lg font-bold">
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
          <div role="toolbar" aria-label={t`地図の道具`} className={floatClass}>
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
              <select id="leg-pick" value={activeId ?? ""} onChange={(e) => pickLeg(e.target.value)} className="h-8 min-h-0 max-w-64 truncate rounded-lg border border-line bg-paper px-2 text-sm font-bold">
                <option value="">{t`区間を選ぶ`}</option>
                {pairs.map((pair) => (
                  <option key={pair.to.key} value={pair.to.key}>
                    {`${legOf(props.legs, pair.from.key, pair.to.key) ? "● " : "○ "}${legLabel(pair)}${timeText(pair)}`}
                  </option>
                ))}
              </select>
              {activePair && mode === "guide" ? (
                <>
                  <span className="px-1 text-sm tabular-nums">{t`ガイド点 ${guideCount}`}</span>
                  <button type="button" disabled={working || guideCount === 0} onClick={() => void routeThroughGuides(activeLeg?.via ?? [])} className={iconBtn} title={t`いまのガイド点を通る道を、もう一度探します`}>
                    {t`もう一度探す`}
                  </button>
                  <button type="button" disabled={working || guideCount === 0} onClick={() => void routeThroughGuides([])} className={`${iconBtn} text-danger`} title={t`ガイド点をすべて消して、道を引きなおします`}>
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
      {props.places.length > 0 ? <PlaceList {...props} /> : null}
    </div>
  );
}

const fieldClass = "h-9 min-h-0 min-w-36 rounded-lg border border-line bg-paper px-2 text-base";
const chipToggle = (on: boolean) =>
  `inline-flex h-8 min-h-0 min-w-0 items-center justify-center rounded-full border px-3 text-sm font-bold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:bg-surface"}`;

/** Every waypoint of the route in one list: its name, its kind and its two switches can all be changed here. */
function PlaceList({ places, selectedKey, onSelectPlace, onRemovePlace, onPatchPlace, onAddEndAt }: Pick<MapEditorProps, "places" | "selectedKey" | "onSelectPlace" | "onRemovePlace" | "onPatchPlace" | "onAddEndAt">) {
  const { t } = useLingui();
  const kindName = useKindLabels();
  const stamps = places.filter((p) => p.stampable).length;
  const others = places.length - stamps;
  // The first stop of the path: a round trip ends where it began, so this is where an end point can be added.
  const firstStop = places.find((p) => !p.stopBy && p.lat !== null)?.key;
  return (
    <section aria-label={t`経由地の一覧`} className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-24">
      <h3 className="text-lg font-bold">
        {t`経由地（${places.length}か所）`}
        <span className="ml-3 text-sm font-normal text-muted">{t`スタンプ ${stamps}・そのほか ${others}`}</span>
      </h3>
      <ol className="flex max-h-[28rem] flex-col gap-2 overflow-auto pr-1 xl:max-h-[calc(100dvh-12rem)]">
        {places.map((p) => (
          <li
            key={p.key}
            onClick={() => onSelectPlace(p.key)}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border bg-paper p-3 ${p.key === selectedKey ? "border-ink ring-2 ring-ink" : "border-line"}`}
          >
            <span
              aria-hidden="true"
              className={`flex shrink-0 items-center justify-center rounded-full text-base font-bold ${p.stampable ? "size-9 bg-brand text-on-brand" : "size-7 border-2 border-ink bg-paper"} ${p.stopBy ? "border-dashed" : ""}`}
            >
              {p.stampable ? p.number : ""}
            </span>
            <input
              value={p.name}
              onChange={(e) => onPatchPlace(p.key, { nameJa: e.target.value })}
              onFocus={() => onSelectPlace(p.key)}
              aria-label={t`名前`}
              placeholder={t`（名前がありません）`}
              maxLength={200}
              className={`${fieldClass} w-full text-lg font-bold`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePlace(p.key);
              }}
              aria-label={t`${p.name || p.number}を消す`}
              aria-disabled={p.published}
              title={p.published ? t`公開中の経由地は削除できません。先に「経由地」タブで「公開をやめる」を押してください。` : t`消す`}
              className={`inline-flex size-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-line ${p.published ? "cursor-not-allowed text-muted opacity-60" : "text-danger hover:bg-surface"}`}
            >
              <TrashIcon />
            </button>
            <div className="col-start-2 col-end-4 flex flex-wrap items-center gap-2">
              <select value={p.kind} onChange={(e) => onPatchPlace(p.key, { kind: e.target.value as PointKind })} aria-label={t`種類`} className={fieldClass}>
                {pointKinds.map((k) => (
                  <option key={k} value={k}>
                    {kindName[k]}
                  </option>
                ))}
              </select>
              <button type="button" aria-pressed={p.stampable} onClick={() => onPatchPlace(p.key, { stampable: !p.stampable })} className={chipToggle(p.stampable)}>
                {t`スタンプ`}
              </button>
              <button type="button" aria-pressed={p.stopBy} onClick={() => onPatchPlace(p.key, { stopBy: !p.stopBy })} className={chipToggle(p.stopBy)}>
                {t`寄り道`}
              </button>
              {p.published ? (
                <span title={t`公開中の経由地は削除できません。編集すると下書きに戻ります。`} className="rounded-full bg-moss px-2.5 py-0.5 text-sm font-bold text-paper">
                  {t`公開中`}
                </span>
              ) : null}
              {p.key === firstStop && places.length >= 2 ? (
                <button type="button" onClick={() => onAddEndAt(p.key)} className={chipToggle(false)} title={t`一周して、ここに戻るルートのとき: 同じ位置に、スタンプのない終点を追加します`}>
                  {t`同じ場所に終点を追加`}
                </button>
              ) : null}
              {p.lat === null ? <span className="text-sm font-bold text-danger">{t`位置なし`}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Small line icons for the bars on the map (each button also has a name for screen readers and a tooltip).
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const CursorIcon = () => (
  <Svg>
    <path d="M4 4l7 17 2.5-7.5L21 11z" />
  </Svg>
);
const PinIcon = () => (
  <Svg>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
const GuideIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" strokeDasharray="3 3" />
    <path d="M3 20c4-1 5-7 9-8s6-6 9-8" strokeDasharray="1 4" />
  </Svg>
);
const PencilIcon = () => (
  <Svg>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
  </Svg>
);
const UndoIcon = () => (
  <Svg>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
const RedoIcon = () => (
  <Svg>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Svg>
);
const TrashIcon = () => (
  <Svg>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
const FitIcon = () => (
  <Svg>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
const TerrainIcon = () => (
  <Svg>
    <path d="M3 20l6-11 4 7 3-4 5 8z" />
  </Svg>
);

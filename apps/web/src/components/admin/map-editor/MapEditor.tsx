"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { TerraDraw, TerraDrawLineStringMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { parseGpx } from "@/lib/admin/gpx";
import { keepElevations, sameLine, simplify, type LngLatEle } from "@/lib/admin/line";
import { boundsOf, lineFeature, mapStyle, routeLineLayers, terrainLayerId, zoomLimits } from "@/lib/map";
import { defaultMapSettings } from "@/lib/map-settings";

export interface EditorPlace {
  key: string;
  lat: number | null;
  lng: number | null;
  /** The number shown on the marker (its place in the list). */
  number: number;
  name: string;
}

export type ElevationStatus = "idle" | "loading" | "partial";

export interface MapEditorProps {
  line: LngLatEle[];
  places: EditorPlace[];
  selectedKey: string | null;
  distanceKm: number | null;
  climbM: number | null;
  elevationStatus: ElevationStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLine: (points: LngLatEle[]) => void;
  onAddPlace: (lat: number, lng: number) => void;
  onMovePlace: (key: string, lat: number, lng: number) => void;
  onRemovePlace: (key: string) => void;
  onSelectPlace: (key: string | null) => void;
}

type Mode = "pan" | "place" | "draw" | "edit" | "erase";

const MAX_POINTS = 2000;
// The saved line is drawn by this layer whenever Terra Draw is not editing it (drawing and editing show Terra Draw's own).
const LINE_SOURCE = "editor-line";
const LINE_LAYERS = routeLineLayers(LINE_SOURCE, false);
const asPositions = (line: readonly LngLatEle[]) => line.map((p) => ({ lng: p[0], lat: p[1] }));
// Where the map starts when there is nothing to show yet: the Katsuragi area.
const START = { center: [135.45, 34.45] as [number, number], zoom: 9 };
const markerClass =
  "flex size-10 items-center justify-center rounded-full border-2 border-paper bg-brand text-lg font-bold text-on-brand shadow-md data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[unplaced=true]:opacity-60";
const toolClass = "tap-target inline-flex items-center justify-center rounded-xl border-2 px-3 text-base font-bold disabled:opacity-40";

const same2d = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

export function MapEditor(props: MapEditorProps) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>("pan");
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [terrain, setTerrain] = useState(false);

  const container = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const lineId = useRef<string | number | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const modeRef = useRef<Mode>("pan");
  const latest = useRef(props);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The handlers below are created once; they read the newest props and mode through these refs.
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ---- the map and Terra Draw, created once ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let draw: TerraDraw | undefined;
    const placeMarkers = markers.current;

    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const { line, places } = latest.current;
      const bounds = boundsOf([...line.map((p) => ({ lng: p[0], lat: p[1] })), ...places.flatMap((p) => (p.lat === null || p.lng === null ? [] : [{ lat: p.lat, lng: p.lng }]))]);
      map = new ml.Map({
        container: container.current,
        style: mapStyle(defaultMapSettings),
        center: START.center,
        zoom: START.zoom,
        bounds: bounds ?? undefined,
        fitBoundsOptions: { padding: 60, maxZoom: 15, animate: false },
        minZoom: zoomLimits.min,
        maxZoom: zoomLimits.max,
        dragRotate: false,
        pitchWithRotate: false,
        doubleClickZoom: false, // a double click finishes a line
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
        draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new TerraDrawLineStringMode({ styles: { lineStringColor: "#cc6256", lineStringWidth: 5 }, editable: false }),
            new TerraDrawSelectMode({
              styles: { selectedLineStringColor: "#8e2a21", selectedLineStringWidth: 5, selectionPointColor: "#ffffff", selectionPointOutlineColor: "#8e2a21", midPointColor: "#8e2a21" },
              flags: { linestring: { feature: { draggable: false, coordinates: { midpoints: true, draggable: true, deletable: true } } } },
            }),
          ],
        });
        map.addSource(LINE_SOURCE, { type: "geojson", data: lineFeature(asPositions(latest.current.line)) });
        for (const layer of LINE_LAYERS) map.addLayer(layer);
        draw.start();
        draw.setMode("static");
        draw.on("finish", () => {
          commit();
          if (modeRef.current === "draw") setMode("edit");
        });
        draw.on("change", (_ids, type) => {
          if (modeRef.current !== "edit" || (type !== "update" && type !== "delete")) return;
          if (commitTimer.current) clearTimeout(commitTimer.current);
          commitTimer.current = setTimeout(commit, 250);
        });
        drawRef.current = draw;
        // Show the line that is already saved.
        pushLineToDraw(latest.current.line);
        setReady(true);
      };
      map.on("styledata", start);
      map.on("load", start);
      start();

      // A click on the map puts a place there, but only while that tool is chosen.
      map.on("click", (e) => {
        if (modeRef.current === "place") latest.current.onAddPlace(e.lngLat.lat, e.lngLat.lng);
      });
    })();

    return () => {
      cancelled = true;
      if (commitTimer.current) clearTimeout(commitTimer.current);
      for (const { marker } of placeMarkers.values()) marker.remove();
      placeMarkers.clear();
      try {
        draw?.stop();
      } catch {
        // the map may already be gone
      }
      map?.remove(); // CLAUDE.md: the map is always removed on unmount
      mapRef.current = null;
      drawRef.current = null;
      lineId.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; everything it needs is read through refs
  }, []);

  /** What Terra Draw holds as lines. */
  function drawnLines() {
    const draw = drawRef.current;
    if (!draw) return [];
    return draw.getSnapshot().filter((f) => f.geometry.type === "LineString");
  }

  /** Make Terra Draw show exactly this line (no change when it already does). */
  function pushLineToDraw(line: LngLatEle[]) {
    const draw = drawRef.current;
    if (!draw) return;
    const coords = line.map((p) => [p[0], p[1]]);
    const lines = drawnLines();
    const current = lines.find((f) => f.id === lineId.current);
    if (coords.length < 2) {
      if (lines.length) draw.removeFeatures(lines.map((f) => f.id as string));
      lineId.current = null;
      return;
    }
    if (current) {
      const have = current.geometry.coordinates as number[][];
      if (have.length === coords.length && have.every((c, i) => same2d(c, coords[i]!))) return;
      draw.updateFeatureGeometry(current.id as string, { type: "LineString", coordinates: coords });
      return;
    }
    const added = draw.addFeatures([{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: { mode: "linestring" } }]);
    lineId.current = (added.find((a) => a.valid)?.id as string | undefined) ?? null;
  }

  /** Take the line Terra Draw holds back into the editor (the newest drawn line wins; others are removed). */
  function commit() {
    const draw = drawRef.current;
    if (!draw) return;
    const lines = drawnLines();
    const pick = lines.find((f) => f.id !== lineId.current) ?? lines[0];
    if (lines.length > 1 && pick) draw.removeFeatures(lines.filter((f) => f.id !== pick.id).map((f) => f.id as string));
    lineId.current = pick ? (pick.id as string) : null;
    const next = pick ? keepElevations(latest.current.line, pick.geometry.coordinates as number[][]) : [];
    if (!sameLine(next, latest.current.line)) latest.current.onLine(next.length >= 2 ? simplify(next, MAX_POINTS) : []);
  }

  // The line prop is the truth: when it changes (undo, import, saved copy) Terra Draw follows.
  useEffect(() => {
    if (ready) pushLineToDraw(props.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pushLineToDraw only reads refs
  }, [props.line, ready]);

  // ---- the tool ----------------------------------------------------------------------------------------------
  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!ready || !draw || !map) return;
    map.getCanvas().style.cursor = mode === "place" ? "crosshair" : "";
    try {
      if (mode === "draw") draw.setMode("linestring");
      else if (mode === "edit") {
        draw.setMode("select");
        if (lineId.current !== null) draw.selectFeature(lineId.current);
      } else draw.setMode("static");
    } catch {
      // A mode that cannot start (for example editing before there is a line) simply stays as it was.
    }
    for (const { marker } of markers.current.values()) marker.setDraggable(mode === "pan" || mode === "place");
    // Terra Draw shows the line while it is being drawn or edited; otherwise this layer does.
    for (const layer of LINE_LAYERS) if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, "visibility", mode === "draw" || mode === "edit" ? "none" : "visible");
  }, [mode, ready]);

  // The saved line, as this layer draws it.
  useEffect(() => {
    const source = mapRef.current?.getSource(LINE_SOURCE) as GeoJSONSource | undefined;
    if (ready && source) source.setData(lineFeature(asPositions(props.line)));
  }, [props.line, ready]);

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
          if (modeRef.current === "erase") latest.current.onRemovePlace(p.key);
          else latest.current.onSelectPlace(p.key);
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
      entry.el.textContent = String(p.number);
      entry.el.setAttribute("aria-label", `${p.number}. ${p.name}`);
      entry.el.dataset.selected = String(p.key === props.selectedKey);
    }
  }, [props.places, props.selectedKey, ready]);

  // ---- toolbar actions -------------------------------------------------------------------------------------
  function fit() {
    const map = mapRef.current;
    if (!map) return;
    const pts = [...props.line.map((p) => ({ lng: p[0], lat: p[1] })), ...props.places.flatMap((p) => (p.lat === null || p.lng === null ? [] : [{ lat: p.lat, lng: p.lng }]))];
    const b = boundsOf(pts);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
  }

  function toggleTerrain() {
    const map = mapRef.current;
    if (!map || !map.getLayer(terrainLayerId)) return;
    const next = !terrain;
    map.setLayoutProperty(terrainLayerId, "visibility", next ? "visible" : "none");
    setTerrain(next);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be chosen again
    if (!file) return;
    setNote(null);
    if (file.size > 20_000_000) return setNote(t`ファイルが大きすぎます（20MBまで）。`);
    const parsed = parseGpx(await file.text());
    if (!parsed.ok) return setNote(t`GPXファイルを読み込めませんでした。道すじ（トラック）が入ったファイルを選んでください。`);
    props.onLine(simplify(parsed.points, MAX_POINTS));
    setMode("edit");
    setNote(t`GPXファイルを読み込みました。形を確かめてから、保存してください。`);
    setTimeout(fit, 100);
  }

  const toolButton = (id: Mode, label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={mode === id}
      onClick={() => {
        setNote(null);
        setMode(id);
      }}
      className={`${toolClass} ${mode === id ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:bg-surface"}`}
    >
      {label}
    </button>
  );

  const help: Record<Mode, string> = {
    pan: t`地図を動かします。数字の丸をドラッグすると、場所を動かせます。`,
    place: t`地図を押すと、その位置に場所を置きます。`,
    draw: t`地図を押して点を置いていきます。最後の点をもう一度押す（またはEnterキー）と、線ができます。Escキーでやり直します。`,
    edit: t`線の点をドラッグして動かします。線の途中の小さな点を引くと、点を増やせます。点を選んでDeleteキーで消せます。`,
    erase: t`消したい場所の数字の丸を押してください。`,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t`地図の道具`}>
        {toolButton("pan", t`動かす`)}
        {toolButton("place", t`場所を置く`)}
        {toolButton("draw", t`線を描く`)}
        {toolButton("edit", t`線を直す`)}
        {toolButton("erase", t`場所を消す`)}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <button type="button" disabled={!props.canUndo} onClick={props.onUndo} className={`${toolClass} border-line bg-paper`}>
          {t`元に戻す`}
        </button>
        <button type="button" disabled={!props.canRedo} onClick={props.onRedo} className={`${toolClass} border-line bg-paper`}>
          {t`やり直す`}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={`${toolClass} border-line bg-paper`}>
          {t`GPXファイルから読み込む`}
        </button>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml,text/xml,application/xml" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <button type="button" disabled={props.line.length === 0} onClick={() => props.onLine([])} className={`${toolClass} border-line bg-paper`}>
          {t`線を消す`}
        </button>
        <button type="button" onClick={fit} className={`${toolClass} border-line bg-paper`}>
          {t`全体を見る`}
        </button>
        <button type="button" aria-pressed={terrain} onClick={toggleTerrain} className={`${toolClass} ${terrain ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
          {t`起伏`}
        </button>
      </div>

      <div className="relative h-[34rem] overflow-hidden rounded-2xl bg-surface">
        <div ref={container} className="h-full w-full" />
        {!ready ? <p className="absolute inset-0 flex items-center justify-center text-lg">{t`地図を読み込み中…`}</p> : null}
      </div>

      <p className="text-base text-muted" aria-live="polite">
        {note ?? help[mode]}
      </p>
      <p className="text-lg font-bold tabular-nums">
        {props.line.length >= 2 ? t`線の長さ ${props.distanceKm ?? 0} km` : t`線は、まだありません。`}
        {props.climbM !== null && props.line.length >= 2 ? <span className="ml-4">{t`登り ${props.climbM} m`}</span> : null}
        {props.elevationStatus === "loading" ? <span className="ml-4 text-base font-normal text-muted">{t`標高を調べています…`}</span> : null}
        {props.elevationStatus === "partial" ? <span className="ml-4 text-base font-normal text-muted">{t`標高が調べられない場所があります。`}</span> : null}
      </p>
    </div>
  );
}

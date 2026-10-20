"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { TerraDraw, TerraDrawLineStringMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { parseGpx, type GpxWaypoint } from "@/lib/admin/gpx";
import { keepElevations, sameLine, simplify, type LngLatEle } from "@/lib/admin/line";
import { searchPlaces, type PlaceHit } from "@/lib/admin/place-search";
import { buildLine, closeLineGaps, smoothLine } from "@/lib/admin/route-builder";
import { roundLine, snapPoints, type SnapPoint } from "@/lib/admin/snap";
import { boundsOf, lineFeature, mapStyle, routeLineLayers, terrainLayerId, zoomLimits } from "@/lib/map";
import { defaultMapSettings } from "@/lib/map-settings";

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
  /** Several places at once (the named points of a GPX file). */
  onAddPlaces: (places: { key: string; name: string; lat: number; lng: number }[]) => void;
  onMovePlace: (key: string, lat: number, lng: number) => void;
  onRemovePlace: (key: string) => void;
  onSelectPlace: (key: string | null) => void;
  /** Switches "stamp here" or "side trip" of a waypoint on or off. */
  onTogglePlace: (key: string, field: "stampable" | "stopBy") => void;
  /** Asks the route-finding service for a walking line through these points (the editor says what went wrong). */
  onSnap: (points: SnapPoint[]) => Promise<{ ok: true; line: LngLatEle[] } | { ok: false; message: string }>;
}

// Three tools for the person: select (move the map, move stops, reshape the line), add a stop, draw the path.
// "pan" and "edit" are the two faces of select: reshaping needs a line to reshape.
type Mode = "pan" | "place" | "draw" | "edit";

const MAX_POINTS = 2000;
// The saved line is drawn by this layer whenever Terra Draw is not editing it (drawing and editing show Terra Draw's own).
const LINE_SOURCE = "editor-line";
const LINE_LAYERS = routeLineLayers(LINE_SOURCE, false);
const asPositions = (line: readonly LngLatEle[]) => line.map((p) => ({ lng: p[0], lat: p[1] }));
// Where the map starts when there is nothing to show yet: the Katsuragi area.
const START = { center: [135.45, 34.45] as [number, number], zoom: 9 };
const markerClass =
  "flex size-10 items-center justify-center rounded-full border-2 border-paper bg-brand text-lg font-bold text-on-brand shadow-md data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[stopby=true]:border-dashed data-[unplaced=true]:opacity-60";
const dotClass =
  "flex size-7 items-center justify-center rounded-full border-2 border-ink bg-paper text-sm font-bold text-ink shadow-md data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[stopby=true]:border-dashed data-[unplaced=true]:opacity-60";
const toolClass = "tap-target inline-flex items-center justify-center rounded-xl border-2 px-3 text-base font-bold disabled:opacity-40";

const same2d = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

export function MapEditor(props: MapEditorProps) {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>("pan");
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [terrain, setTerrain] = useState(false);
  const [waypoints, setWaypoints] = useState<GpxWaypoint[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [building, setBuilding] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlaceHit[] | null>(null);
  const [searching, setSearching] = useState(false);

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
      entry.el.className = p.stampable ? markerClass : dotClass;
      entry.el.textContent = p.stampable ? String(p.number) : "";
      entry.el.dataset.stopby = String(p.stopBy);
      entry.el.setAttribute("aria-label", p.stampable ? `${p.number}. ${p.name}` : p.name);
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

  async function readGpx(file: File | undefined) {
    if (!file) return;
    setNote(null);
    setWaypoints(null);
    if (file.size > 20_000_000) return setNote(t`ファイルが大きすぎます（20MBまで）。`);
    const parsed = parseGpx(await file.text());
    if (!parsed.ok) return setNote(t`GPXファイルを読み込めませんでした。道すじ（トラック）か、名前のついた地点が入ったファイルを選んでください。`);
    if (parsed.points.length >= 2) {
      props.onLine(simplify(parsed.points, MAX_POINTS));
      setMode("edit");
      setTimeout(fit, 100);
      setNote(t`GPXファイルを読み込みました。形を確かめてから、保存してください。`);
    }
    if (parsed.waypoints.length > 0) {
      setWaypoints(parsed.waypoints);
      if (parsed.points.length < 2) setNote(t`GPXファイルに道すじはありませんでした。名前のついた地点だけ見つかりました。`);
    }
  }

  // Joins the drawn line (or the stops) along real walking trails. The route-finding service is asked first; when it is not set
  // up or does not answer, GSI's own trail map does the same job without a key (the way Navivi falls back). The result
  // replaces the line and can be undone.
  async function snapToTrails() {
    const points = snapPoints(props.line, props.places.filter((p) => !p.stopBy));
    if (!points) return setNote(t`先に、線を描くか、経由地を2つ以上置いてください。`);
    setSnapping(true);
    setNote(t`道を調べています…`);
    const result = await props.onSnap(points);
    let line: LngLatEle[];
    let said: string;
    if (result.ok) {
      line = await closeLineGaps(result.line, points);
      said = t`線を道に沿わせました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。`;
    } else {
      setNote(t`国土地理院の道の地図から探しています…`);
      const built = await buildLine(points, "trail");
      if (built.straightHops === points.length - 1) {
        setSnapping(false);
        return setNote(result.message);
      }
      line = built.line;
      const straight = built.straightHops;
      said =
        straight === 0
          ? t`線を、国土地理院の道の地図に沿わせました。形を確かめてから、保存してください。「元に戻す」で、もとの線にもどせます。`
          : t`線を、国土地理院の道の地図に沿わせました。${straight}か所は道が見つからず、まっすぐです。形を確かめてから、保存してください。`;
    }
    setSnapping(false);
    props.onLine(simplify(roundLine(line), MAX_POINTS));
    setMode("edit");
    setTimeout(fit, 100);
    setNote(said);
  }

  // A line through the waypoints in order (a side trip is left out), as Navivi makes one leg for each pair of stops.
  async function makeLine(kind: "trail" | "direct") {
    const stops = props.places.filter((p) => !p.stopBy && p.lat !== null && p.lng !== null).map((p) => ({ lat: p.lat!, lng: p.lng! }));
    if (stops.length < 2) return setNote(t`先に、経由地を2つ以上置いてください（寄り道は数えません）。`);
    setBuilding(true);
    setNote(t`道を調べています…`);
    const { line, straightHops } = await buildLine(stops, kind);
    setBuilding(false);
    props.onLine(simplify(line, MAX_POINTS));
    setMode("edit");
    setTimeout(fit, 100);
    setNote(
      kind === "direct"
        ? t`経由地を、まっすぐにつなぎました。形を確かめてから、保存してください。`
        : straightHops === 0
          ? t`経由地を、道に沿ってつなぎました。形を確かめてから、保存してください。「元に戻す」で、もとにもどせます。`
          : t`経由地を、道に沿ってつなぎました。${straightHops}か所は道が見つからず、まっすぐです。形を確かめてから、保存してください。`,
    );
  }

  // Rounds the corners of a hand-drawn line (Navivi's smooth anchors): fewer, smoother bends.
  function smooth() {
    if (props.line.length < 3) return setNote(t`先に、線を描いてください。`);
    props.onLine(simplify(smoothLine(props.line), MAX_POINTS));
    setNote(t`線の角をなめらかにしました。形を確かめてください。「元に戻す」で、もとの線にもどせます。`);
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

  // Keys: V, P and L pick the tool; Delete removes the chosen stop (not while reshaping the line, where it removes a point).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "v") chooseTool("select");
      else if (key === "p") chooseTool("place");
      else if (key === "l") chooseTool("draw");
      else if ((e.key === "Delete" || e.key === "Backspace") && modeRef.current !== "edit" && latest.current.selectedKey) {
        e.preventDefault();
        latest.current.onRemovePlace(latest.current.selectedKey);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function chooseTool(tool: "select" | "place" | "draw") {
    setNote(null);
    setMode(tool === "select" ? (latest.current.line.length >= 2 ? "edit" : "pan") : tool);
  }

  const toolButton = (tool: "select" | "place" | "draw", label: string, shortcut: string) => {
    const pressed = tool === "select" ? mode === "pan" || mode === "edit" : mode === tool;
    return (
      <button
        key={tool}
        type="button"
        aria-pressed={pressed}
        aria-keyshortcuts={shortcut}
        onClick={() => chooseTool(tool)}
        className={`${toolClass} ${pressed ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:bg-surface"}`}
      >
        {label}
        <kbd className="ml-2 rounded border border-current px-1.5 text-sm font-normal">{shortcut}</kbd>
      </button>
    );
  };

  // What to do next, depending on the tool and on what is already on the map.
  const hasLine = props.line.length >= 2;
  const hasPlaces = props.places.length > 0;
  const hint =
    mode === "place"
      ? t`地図をクリックすると、その位置に経由地を置きます。`
      : mode === "draw"
        ? t`地図をクリックして、点を置いていきます。最後の点をもう一度クリックする（またはEnterキーを押す）と、線ができます。Escキーでやり直します。`
        : hasLine
          ? t`線の点をドラッグして動かします。線の途中の小さな点を引くと、点を増やせます。点を選んでDeleteキーで消せます。数字の丸をドラッグすると、経由地を動かせます。`
          : hasPlaces
            ? t`数字の丸をドラッグすると、経由地を動かせます。道すじは「線を描く」か、GPXファイルで入れます。`
            : t`まず、GPXファイルをここにドラッグするか「GPXファイルから読み込む」を押してください。手で入れるときは「線を描く」で道すじを、「経由地を置く」で経由地を入れます。`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t`地図の道具`}>
        {toolButton("select", t`選ぶ・動かす`, "V")}
        {toolButton("place", t`経由地を置く`, "P")}
        {toolButton("draw", t`線を描く`, "L")}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <button type="button" onClick={() => fileInput.current?.click()} className={`${toolClass} border-ink bg-ink text-paper`}>
          {t`GPXファイルから読み込む`}
        </button>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml,text/xml,application/xml" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <button
          type="button"
          disabled={building || snapping || props.places.filter((p) => !p.stopBy && p.lat !== null).length < 2}
          onClick={() => void makeLine("trail")}
          className={`${toolClass} border-line bg-paper`}
          title={t`経由地を順に、地図の道でつなぎます（寄り道は通りません）`}
        >
          {building ? t`調べています…` : t`経由地をつないで道をつくる`}
        </button>
        <button
          type="button"
          disabled={building || snapping || props.places.filter((p) => !p.stopBy && p.lat !== null).length < 2}
          onClick={() => void makeLine("direct")}
          className={`${toolClass} border-line bg-paper`}
          title={t`経由地を順に、まっすぐな線でつなぎます`}
        >
          {t`まっすぐにつなぐ`}
        </button>
        <button
          type="button"
          disabled={building || snapping || snapPoints(props.line, props.places.filter((p) => !p.stopBy)) === null}
          onClick={snapToTrails}
          className={`${toolClass} border-line bg-paper`}
          title={t`描いた線を、地図の道に沿わせます`}
        >
          {snapping ? t`調べています…` : t`道に沿わせる`}
        </button>
        <button type="button" disabled={props.line.length < 3} onClick={smooth} className={`${toolClass} border-line bg-paper`} title={t`線の角を、丸くなめらかにします`}>
          {t`なめらかにする`}
        </button>
        <button type="button" disabled={!props.canUndo} onClick={props.onUndo} className={`${toolClass} border-line bg-paper`}>
          {t`元に戻す`}
        </button>
        <button type="button" disabled={!props.canRedo} onClick={props.onRedo} className={`${toolClass} border-line bg-paper`}>
          {t`やり直す`}
        </button>
        <button type="button" disabled={props.line.length === 0} onClick={() => props.onLine([])} className={`${toolClass} border-line bg-paper`}>
          {t`線を消す`}
        </button>
        <button type="button" onClick={fit} className={`${toolClass} border-line bg-paper`}>
          {t`全体を見る`}
        </button>
        <button type="button" aria-pressed={terrain} onClick={toggleTerrain} className={`${toolClass} ${terrain ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
          {t`地形の陰影`}
        </button>
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

      <p className="rounded-xl bg-paper px-4 py-3 text-base" aria-live="polite">
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
        className="relative h-[34rem] overflow-hidden rounded-2xl bg-surface"
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
        {dropping ? <p className="absolute inset-0 flex items-center justify-center bg-paper/80 text-xl font-bold">{t`GPXファイルをここで離すと、読み込みます`}</p> : null}
        {!ready ? <p className="absolute inset-0 flex items-center justify-center text-lg">{t`地図を読み込み中…`}</p> : null}
      </div>

      <p className="text-lg font-bold tabular-nums">
        {props.line.length >= 2 ? t`線の長さ ${props.distanceKm ?? 0} km` : t`線は、まだありません。`}
        {props.climbM !== null && props.line.length >= 2 ? <span className="ml-4">{t`登り ${props.climbM} m`}</span> : null}
        {props.elevationStatus === "loading" ? <span className="ml-4 text-base font-normal text-muted">{t`標高を調べています…`}</span> : null}
        {props.elevationStatus === "partial" ? <span className="ml-4 text-base font-normal text-muted">{t`標高が調べられない場所があります。`}</span> : null}
      </p>

      {props.places.length > 0 ? (
        <div className="flex flex-col gap-4">
          <PlaceGroup {...props} title={t`スタンプを押せる経由地`} places={props.places.filter((p) => p.stampable)} />
          <PlaceGroup {...props} title={t`ほかの経由地（道案内・寄り道など）`} places={props.places.filter((p) => !p.stampable)} />
        </div>
      ) : null}
    </div>
  );
}

/** One of the two lists under the map: the waypoints with a stamp, and the others. */
function PlaceGroup({ title, places, selectedKey, onSelectPlace, onRemovePlace, onTogglePlace }: { title: string; places: EditorPlace[] } & Pick<MapEditorProps, "selectedKey" | "onSelectPlace" | "onRemovePlace" | "onTogglePlace">) {
  const { t } = useLingui();
  if (places.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">{t`${title}（${places.length}か所）`}</h3>
      <ol className="flex max-h-64 flex-col gap-1 overflow-auto">
        {places.map((p) => (
          <li key={p.key} className={`flex flex-wrap items-center gap-3 rounded-xl p-2 ${p.key === selectedKey ? "bg-paper ring-2 ring-ink" : ""}`}>
            <span
              aria-hidden="true"
              className={`flex shrink-0 items-center justify-center rounded-full text-base font-bold ${p.stampable ? "size-8 bg-brand text-on-brand" : "size-6 border-2 border-ink bg-paper"} ${p.stopBy ? "border-dashed" : ""}`}
            >
              {p.stampable ? p.number : ""}
            </span>
            <button type="button" onClick={() => onSelectPlace(p.key === selectedKey ? null : p.key)} className="min-w-0 flex-1 truncate text-left text-lg text-accent underline underline-offset-4">
              {p.name || t`（名前がありません）`}
            </button>
            <label className="flex items-center gap-1 text-base">
              <input type="checkbox" checked={p.stopBy} onChange={() => onTogglePlace(p.key, "stopBy")} className="size-5" />
              {t`寄り道`}
            </label>
            <label className="flex items-center gap-1 text-base">
              <input type="checkbox" checked={p.stampable} onChange={() => onTogglePlace(p.key, "stampable")} className="size-5" />
              {t`スタンプ`}
            </label>
            <span className="text-base text-muted">{p.lat === null ? t`位置なし` : t`位置あり`}</span>
            <button type="button" onClick={() => onRemovePlace(p.key)} aria-label={t`${p.name || p.number}を消す`} className="tap-target rounded-xl border-2 border-danger px-3 text-base font-bold text-danger">
              {t`消す`}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

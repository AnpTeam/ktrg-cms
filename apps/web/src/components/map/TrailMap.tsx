"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ExpandIcon, WarningIcon } from "@/components/icons";
import { SampleNoticeButton } from "@/components/SampleNotice";
import { clusterByPixels } from "@/lib/cluster";
import type { SpotStatus } from "@/lib/content";
import {
  boundsOf,
  lineFeature,
  mapStyle,
  markerKind,
  nextStopId,
  pinScale, PIN_NUMBER_MIN_ZOOM,
  routeLineLayers,
  sideLineCollection,
  sideLineLayers,
  terrainLayerId,
  zoomLimits,
  type Position,
} from "@/lib/map";
import type { MapSettings } from "@/lib/map-settings";
import type { StopRole } from "@/lib/route-stops";
import type { PointKind } from "@/lib/point-kinds";
import { SAME_PLACE_M, spreadMeters, stopMergePx } from "@/lib/map-screen";
import { groupCounts, groupOf, sortByDistance, type Coord, type MapPlace, type PlaceGroup } from "@/lib/places";
import { createClusterElement, createMarkerElement, createPlaceMarkerElement } from "./MapMarker";
import { MapPickList } from "./MapPickList";
import { PlaceCard, PlaceChips, PlaceList, useGroupNames } from "./PlacesPanel";
import { StopCard } from "./StopCard";

export interface MapStop {
  id: string;
  /** 1, 2, 3 ... in walking order, stamp places only; the number shown on the marker. null for a side trip and a place without a stamp. */
  order: number | null;
  name: string;
  /** The spoken name of the marker, for example "3. 猿坂峠, stamped". */
  label: string;
  nameLang: "ja" | "en";
  position: { lat: number; lng: number };
  /** null when signed out. */
  stamped: boolean | null;
  status: SpotStatus;
  /** The spot page, already with the locale. */
  href: string;
  /** An optional visit beside the way (寄り道): its pin is drawn smaller, and its line thin, dashed and blue. */
  sideTrip?: boolean;
  /** A place where no stamp can be collected (a toilet, a station ...): a square pin, never "next to stamp". */
  noStamp?: boolean;
  /** Where the walk starts and ends: the pin takes the Start (blue), Goal (orange) or both colours. */
  role?: StopRole;
  /** What the place is, shown as a small picture on the pin. */
  kind?: PointKind;
}

type Selection = { kind: "stop" | "place"; id: string } | null;

const LINE_SOURCE = "route";
const SIDE_SOURCE = "route-side";
// A constant, not `[]` in the parameter list: a new array each render would rebuild the map each render.
const NO_SIDE_LINES: Position[][] = [];
// Keep every stop clear of the buttons: zoom buttons at the top right, the chip at the top left,
// the "bigger" button and the credit line along the bottom.
const FIT = { padding: { top: 76, bottom: 112, left: 56, right: 92 }, maxZoom: 16, animate: false } as const;
// Markers closer than this on screen are shown as one numbered group (a stop is 3rem = 48 px wide).
const CLUSTER_PX = 52;
const buttonClass =
  "tap-target inline-flex items-center justify-center gap-2 rounded-lg border border-ink bg-paper px-3 text-lg font-bold text-ink hover:bg-surface";

const centerOf = (points: readonly Coord[]): Coord => ({
  lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
  lng: points.reduce((n, p) => n + p.lng, 0) / points.length,
});

/**
 * The trail map (WBS 3.2.1, 3.2.2): GSI tiles, the route line, one numbered button per stop and, on
 * request, the places around (toilets, shops ...).
 * - Embedded, a finger on the map still scrolls the page (two fingers move the map; the zoom
 *   buttons always work); "bigger" opens it full screen with full pan and zoom.
 * - Markers that would overlap are merged into one group button; tapping it zooms in.
 * - `line` is the real path when the CMS has it; without it the stops are joined by dashed lines.
 */
export function TrailMap({
  stops,
  line,
  sideLines = NO_SIDE_LINES,
  places,
  draft,
  settings,
  mergeStops,
  placesFirst,
}: {
  stops: MapStop[];
  line: Position[] | null;
  /** Side trips (寄り道): thin dashed blue lines out to stop-by places. */
  sideLines?: Position[][];
  places: MapPlace[];
  draft: boolean;
  settings: MapSettings;
  /** The visitor's choice: merge stops that are close together (off = every stop is its own button). */
  mergeStops: boolean;
  /** The visitor's choice: show the nearby places from the start. */
  placesFirst: boolean;
}) {
  const { t } = useLingui();
  const groupNames = useGroupNames();
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const buttonByKey = useRef(new Map<string, HTMLElement>());
  const expandRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mapGen, setMapGen] = useState(0); // bumped each time a map is created
  const [view, setView] = useState(0); // bumped each time the map stops moving
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [terrain, setTerrain] = useState(false);
  // Side trips (寄り道) are off at first: some places are worth a mention without being a stop on the way.
  const [showSide, setShowSide] = useState(false);
  const hasSide = sideLines.some((l) => l.length >= 2);
  const [selected, setSelected] = useState<Selection>(null);
  // Pins that stand on one spot cannot be pulled apart by zooming: a short list chooses among them.
  const [pick, setPick] = useState<MapStop[] | null>(null);
  // Every kind of place that exists on this course is on from the start when the visitor chose that.
  const [active, setActive] = useState<ReadonlySet<PlaceGroup>>(
    () => new Set(placesFirst ? (Object.keys(groupCounts(places)) as PlaceGroup[]) : []),
  );

  const counts = useMemo(() => groupCounts(places), [places]);
  const visiblePlaces = useMemo(() => places.filter((p) => active.has(groupOf(p.category))), [places, active]);
  const selectedStop = selected?.kind === "stop" ? stops.find((s) => s.id === selected.id) : undefined;
  const selectedPlace = selected?.kind === "place" ? places.find((p) => p.id === selected.id) : undefined;
  // Distances are measured from the chosen stop, or else from the start of the course.
  const origin: Coord | undefined = selectedStop?.position ?? stops[0]?.position;

  // Create the map once for these inputs; remove it again on unmount (CLAUDE.md: map.remove()).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        // A rebuilt map (the style settings changed) has not loaded its style yet, whatever the old one did.
        setLoaded(false);
        // MapLibre 6 runs its tile work in a separate worker file. Under Next.js the bundler must
        // emit that file, which this new URL(..., import.meta.url) pattern (from MapLibre's own
        // docs for Next.js 15 and later) does. Without it: "Worker failed to load".
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const stopPoints = stops.map((s) => s.position);
        const linePoints = line ?? stopPoints;
        const bounds = boundsOf([...stopPoints, ...linePoints]);
        map = new ml.Map({
          container: containerRef.current,
          style: mapStyle(settings),
          bounds: bounds ?? undefined,
          fitBoundsOptions: FIT,
          minZoom: zoomLimits.min,
          maxZoom: zoomLimits.max,
          dragRotate: false,
          pitchWithRotate: false,
          // One finger scrolls the page, two fingers move the map: no trap on a long page.
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.MobileHelpText": t`2本の指で地図を動かします`,
            "CooperativeGesturesHandler.WindowsHelpText": t`Ctrlキーを押しながら地図を動かします`,
            "CooperativeGesturesHandler.MacHelpText": t`⌘キーを押しながら地図を動かします`,
          },
          attributionControl: { compact: false },
          // Without this the map prints as a blank box (the browser prints what the canvas still holds).
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.touchZoomRotate.disableRotation();
        // A tile that cannot be fetched (weak signal) is normal, not an error to shout about: the
        // background shows and the tile is retried when the map moves.
        map.on("error", () => {});
        map.on("moveend", () => setView((v) => v + 1));
        // The pins are smaller when zoomed out (the markers read this size from the map's own element).
        const sizePins = () => {
          containerRef.current?.style.setProperty("--pin", String(pinScale(map!.getZoom())));
          containerRef.current?.toggleAttribute("data-far", map!.getZoom() < PIN_NUMBER_MIN_ZOOM);
        };
        map.on("zoom", sizePins);
        sizePins();

        // Ready as soon as the style is: MapLibre's own "load" waits for every visible tile, which
        // on a weak mountain signal can take very long. The line, markers and buttons must not
        // wait for that; tiles simply fill in as they arrive. A single event can be missed, so
        // this is tried on every style update and on load, and runs only once.
        let started = false;
        const start = () => {
          if (started || cancelled || !map || !map.isStyleLoaded()) return;
          started = true;
          // Side trips first, so the route's own line is drawn over them.
          map.addSource(SIDE_SOURCE, { type: "geojson", data: sideLineCollection(sideLines) });
          for (const layer of sideLineLayers(SIDE_SOURCE)) map.addLayer(layer);
          map.addSource(LINE_SOURCE, { type: "geojson", data: lineFeature(linePoints) });
          for (const layer of routeLineLayers(LINE_SOURCE, line === null)) map.addLayer(layer);
          setLoaded(true);
        };
        map.on("styledata", start);
        map.on("load", start);
        start();

        mapRef.current = map;
        mlRef.current = ml;
        setMapGen((g) => g + 1);
      } catch {
        // No WebGL, or the library failed to load: the list on the page still works.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // `t` changes only with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, line, sideLines, settings]);

  // Zoom in on a group of markers (or on one spot when they all sit on the same point).
  const zoomTo = (points: readonly Coord[]) => {
    const map = mapRef.current;
    const bounds = boundsOf(points);
    if (!map || !bounds) return;
    const [[w, s], [e, n]] = bounds;
    if (w === e && s === n) map.easeTo({ center: [w, s], zoom: Math.min(map.getZoom() + 2, 17) });
    else map.fitBounds(bounds, { padding: 90, maxZoom: 17 });
  };

  // Draw the markers. Merged groups depend on the zoom, so this runs again whenever the map settles.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;
    const live: { remove: () => void }[] = [];
    const buttons = buttonByKey.current;
    buttons.clear();
    const put = (el: HTMLElement, at: Coord, anchor: "center" | "bottom" = "center") =>
      live.push(new ml.Marker({ element: el, anchor }).setLngLat([at.lng, at.lat]).addTo(map));
    const pixel = (id: string, at: Coord) => {
      const p = map.project([at.lng, at.lat]);
      return { id, x: p.x, y: p.y };
    };

    // Places first, so the numbered stops sit on top of them.
    const placeById = new Map(visiblePlaces.map((p) => [p.id, p]));
    const group = (points: { id: string; x: number; y: number }[]) =>
      mergeStops ? clusterByPixels(points, CLUSTER_PX) : points.map((p) => [p.id]);
    for (const ids of group(visiblePlaces.map((p) => pixel(p.id, p.position)))) {
      const members = ids.map((id) => placeById.get(id)!);
      if (members.length === 1) {
        const place = members[0]!;
        const el = createPlaceMarkerElement({
          group: groupOf(place.category),
          category: place.category,
          label: place.name,
          closed: place.status === "closed" || place.status === "gone",
          onSelect: () => setSelected({ kind: "place", id: place.id }),
        });
        buttons.set(`place:${place.id}`, el);
        put(el, place.position);
      } else {
        const count = members.length;
        const el = createClusterElement({
          text: String(count),
          label: t`${count}か所の場所がここに集まっています。押すと拡大します`,
          kind: "places",
          onSelect: () => zoomTo(members.map((m) => m.position)),
        });
        put(el, centerOf(members.map((m) => m.position)));
      }
    }

    const next = nextStopId(stops);
    const stopById = new Map(stops.map((s) => [s.id, s]));
    // Pins that touch always merge (one would hide the other); the accessibility choice only makes them merge earlier.
    for (const ids of clusterByPixels(stops.map((s) => pixel(s.id, s.position)), stopMergePx(mergeStops))) {
      const members = ids.map((id) => stopById.get(id)!);
      if (members.length === 1) {
        const stop = members[0]!;
        const el = createMarkerElement({
          order: stop.order,
          label: stop.label,
          kind: stop.noStamp ? "neutral" : markerKind(stop.stamped, stop.id === next),
          status: stop.status,
          sideTrip: stop.sideTrip,
          noStamp: stop.noStamp,
          role: stop.role,
          place: stop.kind,
          stamped: stop.stamped === true,
          onSelect: () => setSelected({ kind: "stop", id: stop.id }),
        });
        buttons.set(`stop:${stop.id}`, el);
        put(el, stop.position, stop.sideTrip ? "center" : "bottom");
      } else {
        const orders = members.flatMap((m) => (m.order === null ? [] : [m.order]));
        const text = orders.length > 1 ? `${Math.min(...orders)}–${Math.max(...orders)}` : String(members.length);
        const el = createClusterElement({
          text,
          label: t`場所 ${text} がここに集まっています。押すと拡大します`,
          kind: "stops",
          // Pins on the same spot cannot be pulled apart by zooming: they are chosen from a list.
          onSelect: () => (spreadMeters(members.map((m) => m.position)) <= SAME_PLACE_M ? setPick(members) : zoomTo(members.map((m) => m.position))),
        });
        put(el, centerOf(members.map((m) => m.position)));
      }
    }

    return () => {
      live.forEach((m) => m.remove());
      buttons.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapGen, view, stops, visiblePlaces, mergeStops]);

  // Mark the selected marker for screen readers and for the highlighted look.
  useEffect(() => {
    buttonByKey.current.forEach((el, key) =>
      el.setAttribute("aria-pressed", String(selected !== null && key === `${selected.kind}:${selected.id}`)),
    );
  }, [selected, mapGen, view, visiblePlaces]);

  // Embedded: a finger scrolls the page. Expanded: the whole screen is the map, so one finger moves it.
  // Either way the map is resized and fitted again once the layout has settled.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (expanded) map.cooperativeGestures.disable();
    else map.cooperativeGestures.enable();
    const timer = window.setTimeout(() => {
      map.resize();
      const bounds = boundsOf([
        ...stops.map((s) => s.position),
        ...(line ?? []),
        ...visiblePlaces.map((p) => p.position),
      ]);
      if (bounds) map.fitBounds(bounds, FIT);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [expanded, loaded, mapGen, stops, line, visiblePlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    for (const id of [`${SIDE_SOURCE}-casing`, `${SIDE_SOURCE}-line`]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showSide ? "visible" : "none");
    }
  }, [showSide, loaded, mapGen]);

  useEffect(() => {
    const map = mapRef.current;
    // Only on a map whose style has finished loading, and only if it has the overlay.
    if (map && loaded && map.isStyleLoaded() && map.getLayer(terrainLayerId)) {
      map.setLayoutProperty(terrainLayerId, "visibility", terrain ? "visible" : "none");
    }
  }, [terrain, loaded, mapGen]);

  // Expanded view: keep the page still behind it, close on Escape, and move focus sensibly.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    closeRef.current?.focus();
    const opener = expandRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
      opener?.focus();
    };
  }, [expanded]);

  const zoom = (delta: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const options = calm ? { duration: 0 } : undefined;
    if (delta > 0) map.zoomIn(options);
    else map.zoomOut(options);
  };

  // The plain map's stop-by-stop control: previous and next move the map to one stop at a time, so a
  // visitor never has to tap a stop in a crowd of markers.
  const stopIndex = selectedStop ? stops.findIndex((s) => s.id === selectedStop.id) : -1;
  const goToStop = (delta: 1 | -1) => {
    const index = Math.min(stops.length - 1, Math.max(0, stopIndex === -1 ? (delta > 0 ? 0 : stops.length - 1) : stopIndex + delta));
    const stop = stops[index];
    const map = mapRef.current;
    if (!stop) return;
    setSelected({ kind: "stop", id: stop.id });
    map?.easeTo({ center: [stop.position.lng, stop.position.lat], zoom: Math.max(map.getZoom(), 15.5) });
  };

  const toggleGroup = (group: PlaceGroup) =>
    setActive((current) => {
      const next = new Set(current);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  // Picking a place in the list: show it on the map and bring the map into view.
  const showPlace = (id: string) => {
    const place = places.find((p) => p.id === id);
    const map = mapRef.current;
    setSelected({ kind: "place", id });
    if (!place || !map) return;
    map.easeTo({ center: [place.position.lng, place.position.lat], zoom: Math.max(map.getZoom(), 15.5) });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  };

  const sortedPlaces = useMemo(
    () => (origin ? sortByDistance(visiblePlaces, origin) : visiblePlaces.map((p) => ({ ...p, meters: 0 }))),
    [visiblePlaces, origin],
  );
  const stopName = selectedStop?.name ?? "";
  const fromLabel = selectedStop
    ? t`「${stopName}」から近い順`
    : t`コースの出発地点から近い順（まっすぐ測った距離です）`;
  const terrainLabel =
    settings.terrain === "relief"
      ? terrain ? t`標高の色を消す` : t`標高の色を見る`
      : terrain ? t`地形の陰影を消す` : t`地形の陰影を見る`;
  const anyPlaces = places.length > 0;
  const restName = groupNames.rest;
  const shopsName = groupNames.shops;

  if (failed) {
    return (
      <p className="rounded-2xl bg-surface p-4 text-lg">
        {t`この端末では地図を表示できません。下の一覧から場所を選べます。`}
      </p>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label={t`地図`}
      data-dark={settings.dark}
      className={expanded ? "trail-map fixed inset-0 z-30 flex flex-col gap-3 bg-paper p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "trail-map flex scroll-mt-2 flex-col gap-3"}
    >
      {expanded ? (
        <div className="flex items-center justify-between gap-2">
          {draft ? <SampleNoticeButton /> : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTerrain((on) => !on)} aria-pressed={terrain} className={buttonClass}>
              {terrainLabel}
            </button>
            <button ref={closeRef} type="button" onClick={() => setExpanded(false)} className={buttonClass}>
              {t`閉じる`}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={
          expanded
            ? "relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-line"
            : "relative -mx-4 h-[min(46svh,36rem)] min-h-[18rem] overflow-hidden rounded-none border-x-0 border-y-2 border-line @4xl:mx-0 @4xl:rounded-xl @4xl:border-x-2"
        }
      >
        {/* MapLibre's own CSS makes its container position: relative, which would cancel an
            absolute inset-0 on it, so the wrapper does the sizing and the container fills it. */}
        <div className="trail-map-canvas absolute inset-0">
          <div ref={containerRef} className="h-full w-full" />
        </div>

        {loaded ? null : (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-lg">
            {t`地図を読み込み中…`}
          </p>
        )}

        {pick ? (
          <MapPickList
            items={pick.map((s) => ({ id: s.id, order: s.order, name: s.name, nameLang: s.nameLang }))}
            bottomPx={0}
            onPick={(id) => {
              setPick(null);
              setSelected({ kind: "stop", id });
            }}
            onClose={() => setPick(null)}
          />
        ) : null}

        {draft ? (
          <p className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
            <span className="text-caution">
              <WarningIcon />
            </span>
            {t`仮のルート・位置（未確認）`}
          </p>
        ) : null}

        <div className="absolute right-2 top-2 z-10 flex flex-col gap-2 print:hidden">
          <button type="button" onClick={() => zoom(1)} aria-label={t`拡大`} className={`${buttonClass} text-2xl`}>
            ＋
          </button>
          <button type="button" onClick={() => zoom(-1)} aria-label={t`縮小`} className={`${buttonClass} text-2xl`}>
            －
          </button>
        </div>

        {expanded ? null : (
          <div className="absolute bottom-9 left-2 z-10 print:hidden">
            <button ref={expandRef} type="button" onClick={() => setExpanded(true)} className={buttonClass}>
              <ExpandIcon />
              {t`大きく表示`}
            </button>
          </div>
        )}
      </div>

      {hasSide ? (
        <button type="button" aria-pressed={showSide} onClick={() => setShowSide((on) => !on)} className={`${buttonClass} w-fit`}>
          {t`寄り道の線を見る`}
        </button>
      ) : null}

      {!mergeStops && stops.length > 1 ? (
        <div role="group" aria-label={t`場所を順に見る`} className="flex items-stretch gap-2">
          <button type="button" onClick={() => goToStop(-1)} disabled={stopIndex === 0} className={`${buttonClass} flex-1`}>
            {t`＜ 前へ`}
          </button>
          <p aria-live="polite" className="flex min-w-[5.5rem] items-center justify-center text-xl font-bold tabular-nums">
            {stopIndex === -1 ? "－" : stopIndex + 1} / {stops.length}
          </p>
          <button
            type="button"
            onClick={() => goToStop(1)}
            disabled={stopIndex === stops.length - 1}
            className={`${buttonClass} flex-1`}
          >
            {t`次へ ＞`}
          </button>
        </div>
      ) : null}

      {selectedStop ? (
        <StopCard
          order={selectedStop.order}
          name={selectedStop.name}
          nameLang={selectedStop.nameLang}
          status={selectedStop.status}
          href={selectedStop.href}
          noStamp={selectedStop.noStamp}
          draft={draft}
        />
      ) : null}
      {selectedPlace ? (
        <PlaceCard
          place={selectedPlace}
          meters={origin ? sortByDistance([selectedPlace], origin)[0]!.meters : null}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {anyPlaces ? (
        <div className="flex flex-col gap-2">
          {expanded ? null : <p className="text-lg font-bold">{t`まわりの場所を地図に出す`}</p>}
          <PlaceChips counts={counts} active={active} onToggle={toggleGroup} />
        </div>
      ) : null}

      {!expanded && sortedPlaces.length > 0 ? (
        <PlaceList items={sortedPlaces} fromLabel={fromLabel} selectedId={selectedPlace?.id ?? null} onSelect={showPlace} />
      ) : null}
      {!expanded && anyPlaces && sortedPlaces.length === 0 ? (
        <p className="text-lg text-muted">
          {t`上のボタンを押すと、${restName}や${shopsName}などが地図と一覧に出ます。`}
        </p>
      ) : null}
    </section>
  );
}

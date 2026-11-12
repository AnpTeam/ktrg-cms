"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ChevronIcon, ChevronLeftIcon, ExpandIcon, ListIcon, MinusIcon, PlusIcon, WarningIcon } from "@/components/icons";
import { SampleNoticeButton } from "@/components/SampleNotice";
import { pinPhotoSrc } from "@/lib/pin-photo";
import type { MapPhoto } from "@/lib/map-screen";
import type { SpotStatus } from "@/lib/content";
import {
  boundsOf,
  lineFeature,
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
import { mapStyleSource } from "@/lib/large-map-style";
import type { MapSettings } from "@/lib/map-settings";
import type { StopRole } from "@/lib/route-stops";
import type { PointKind } from "@/lib/point-kinds";
import { groupCounts, groupOf, sortByDistance, type Coord, type MapPlace, type PlaceGroup } from "@/lib/places";
import { createMarkerElement, createPlaceMarkerElement } from "./MapMarker";
import { useCursorMarker } from "./useCursorMarker";
import { PlaceCard, PlaceChips, PlaceList } from "./PlacesPanel";
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
  /** An optional visit beside the way (寄り道): its pin has no number, and its line is thin, dashed and blue. */
  sideTrip?: boolean;
  /** A place where no stamp can be collected (a toilet, a station ...): a square pin, never "next to stamp". */
  noStamp?: boolean;
  /** Where the walk starts and ends: the pin takes the Start (blue), Goal (orange) or both colours. */
  role?: StopRole;
  /** What the place is, shown as a small picture on the pin. */
  kind?: PointKind;
  /** The place's own uploaded photo: the pin's head shows it (see lib/pin-photo.ts). */
  photo?: MapPhoto | null;
}

type Selection = { kind: "stop" | "place"; id: string } | null;

const LINE_SOURCE = "route";
const SIDE_SOURCE = "route-side";
// A constant, not `[]` in the parameter list: a new array each render would rebuild the map each render.
const NO_SIDE_LINES: Position[][] = [];
// Keep every stop clear of the buttons: zoom buttons at the top right, the chip at the top left,
// the "bigger" button and the credit line along the bottom.
const FIT = { padding: { top: 76, bottom: 112, left: 56, right: 92 }, maxZoom: 16, animate: false } as const;
const buttonClass =
  "tap-target inline-flex items-center justify-center gap-2 rounded-full border border-ink bg-paper px-3 text-lg font-bold text-ink hover:bg-surface";
// The small round controls laid over the map: a 48 px target (the older-reader rule) with a smaller circle drawn in it.
const hit = "tap-target inline-flex items-center justify-center disabled:opacity-40";
const disc = "flex size-9 items-center justify-center rounded-full border border-ink bg-paper/95 text-ink shadow-sm";

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
  placesFirst,
}: {
  stops: MapStop[];
  line: Position[] | null;
  /** Side trips (寄り道): thin dashed blue lines out to stop-by places. */
  sideLines?: Position[][];
  places: MapPlace[];
  draft: boolean;
  settings: MapSettings;
  /** The visitor's choice: show the nearby places from the start. */
  placesFirst: boolean;
}) {
  const { t, i18n } = useLingui();
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const buttonByKey = useRef(new Map<string, HTMLElement>());
  const expandRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mapGen, setMapGen] = useState(0); // bumped each time a map is created
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [terrain, setTerrain] = useState(false);
  // Side trips (寄り道) are off at first: some places are worth a mention without being a stop on the way.
  const [showSide, setShowSide] = useState(false);
  const hasSide = sideLines.some((l) => l.length >= 2);
  const [selected, setSelected] = useState<Selection>(null);
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
          style: mapStyleSource(settings, i18n.locale),
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
  }, [stops, line, sideLines, settings, i18n.locale]);

  useCursorMarker(mapRef, mlRef, mapGen);

  // Draw the markers: one button per stop and place, the same at every zoom.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;
    const live: { remove: () => void }[] = [];
    const buttons = buttonByKey.current;
    buttons.clear();
    const put = (el: HTMLElement, at: Coord, anchor: "center" | "bottom" = "center") =>
      live.push(new ml.Marker({ element: el, anchor }).setLngLat([at.lng, at.lat]).addTo(map));

    // Places first, so the numbered stops sit on top of them. Every place and stop is its own button, never merged into a
    // group (2026-11-11): a merged button gets in the way when moving the map. Pins on one spot overlap; the previous and
    // next buttons reach each of them.
    for (const place of visiblePlaces) {
      const el = createPlaceMarkerElement({
        group: groupOf(place.category),
        category: place.category,
        icon: place.icon,
        label: place.name,
        closed: place.status === "closed" || place.status === "gone",
        onSelect: () => setSelected({ kind: "place", id: place.id }),
      });
      buttons.set(`place:${place.id}`, el);
      put(el, place.position);
    }

    const next = nextStopId(stops);
    for (const stop of stops) {
      const el = createMarkerElement({
        order: stop.order,
        label: stop.label,
        kind: stop.noStamp ? "neutral" : markerKind(stop.stamped, stop.id === next),
        status: stop.status,
        sideTrip: stop.sideTrip,
        noStamp: stop.noStamp,
        role: stop.role,
        place: stop.kind,
        photo: pinPhotoSrc(stop.photo),
        stamped: stop.stamped === true,
        onSelect: () => setSelected({ kind: "stop", id: stop.id }),
      });
      buttons.set(`stop:${stop.id}`, el);
      put(el, stop.position, "bottom");
    }

    return () => {
      live.forEach((m) => m.remove());
      buttons.clear();
    };
  }, [mapGen, stops, visiblePlaces]);

  // Mark the selected marker for screen readers and for the highlighted look.
  useEffect(() => {
    buttonByKey.current.forEach((el, key) =>
      el.setAttribute("aria-pressed", String(selected !== null && key === `${selected.kind}:${selected.id}`)),
    );
  }, [selected, mapGen, stops, visiblePlaces]);

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
    setListOpen(false);
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

  if (failed) {
    return (
      <p className="rounded-2xl bg-surface p-4 text-lg">
        {t`この端末では地図を表示できません。下の一覧から場所を選べます。`}
      </p>
    );
  }

  const stepper = stops.length > 1;

  return (
    <section
      ref={sectionRef}
      aria-label={t`地図`}
      className={expanded ? "trail-map fixed inset-0 z-30 flex flex-col gap-3 bg-paper p-3 pt-[calc(0.75rem+var(--top-clear))]" : "trail-map relative flex scroll-mt-2 flex-col gap-2 @4xl:h-full"}
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

      {/* Everything the visitor works the map with lies on it (2026-11-11): the small zoom and full-screen buttons at the
          top right, the kinds of place at the bottom left, previous and next stop at the bottom right, and the stop's card
          above them. On a wide page the map is the whole right column, to the screen's edges. */}
      <div
        className={
          expanded
            ? "relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-line"
            : "relative -mx-4 h-[min(62svh,40rem)] min-h-[20rem] overflow-hidden border-y-2 border-line @4xl:mx-0 @4xl:h-full @4xl:min-h-0 @4xl:border-0"
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

        {draft ? (
          <p className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-4rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
            <span className="text-caution">
              <WarningIcon />
            </span>
            {t`仮のルート・位置（未確認）`}
          </p>
        ) : null}

        <div className="absolute right-1 top-1 z-10 flex flex-col print:hidden">
          <button type="button" onClick={() => zoom(1)} aria-label={t`拡大`} className={hit}>
            <span className={disc}>
              <PlusIcon size={20} />
            </span>
          </button>
          <button type="button" onClick={() => zoom(-1)} aria-label={t`縮小`} className={hit}>
            <span className={disc}>
              <MinusIcon size={20} />
            </span>
          </button>
          {expanded ? null : (
            <button ref={expandRef} type="button" onClick={() => setExpanded(true)} aria-label={t`大きく表示`} className={hit}>
              <span className={disc}>
                <ExpandIcon />
              </span>
            </button>
          )}
        </div>

        {listOpen && sortedPlaces.length > 0 ? (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-paper p-4">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setListOpen(false)} className={buttonClass}>
                {t`閉じる`}
              </button>
            </div>
            <PlaceList items={sortedPlaces} fromLabel={fromLabel} selectedId={selectedPlace?.id ?? null} onSelect={showPlace} />
          </div>
        ) : null}
      </div>
      <div className={`flex flex-col gap-2 px-3 pb-2 print:hidden ${expanded ? "" : "@4xl:pointer-events-none @4xl:absolute @4xl:inset-x-2 @4xl:bottom-8 @4xl:z-10 @4xl:max-h-[calc(100%-4rem)] @4xl:p-0 @4xl:[&>*]:pointer-events-auto"}`}>
        {selectedStop || selectedPlace ? (
          <div className="order-2 min-h-0 overflow-y-auto rounded-xl shadow-md @4xl:order-none">
            {selectedStop ? (
              <StopCard
                order={selectedStop.order}
                name={selectedStop.name}
                nameLang={selectedStop.nameLang}
                status={selectedStop.status}
                href={selectedStop.href}
                noStamp={selectedStop.noStamp}
                draft={draft}
                onClose={() => setSelected(null)}
              />
            ) : selectedPlace ? (
              <PlaceCard place={selectedPlace} meters={origin ? sortByDistance([selectedPlace], origin)[0]!.meters : null} onClose={() => setSelected(null)} />
            ) : null}
          </div>
        ) : null}
        {/* On a phone the row dissolves into the block (contents) so the stepper stays right under the map, then the stop's card, then the chips. */}
          <div className="contents @4xl:flex @4xl:flex-row @4xl:items-end @4xl:justify-between @4xl:gap-2">
          {/* Under the map: one tidy two-column grid of the kinds of place and the two other buttons. Over the map (4xl): small chips that wrap. */}
              <div className="order-3 grid min-w-0 grid-cols-2 gap-2 @4xl:order-none @4xl:flex @4xl:flex-wrap @4xl:gap-1.5">
            {anyPlaces ? <PlaceChips compact className="contents @4xl:flex @4xl:flex-wrap @4xl:gap-1.5" counts={counts} active={active} onToggle={toggleGroup} /> : null}
            {hasSide ? (
              <button type="button" aria-pressed={showSide} onClick={() => setShowSide((on) => !on)} className={`${buttonClass} w-full justify-start @4xl:w-auto ${showSide ? "!bg-ink !text-paper" : "bg-paper/95 shadow-sm"}`}>
                {t`寄り道の線を見る`}
              </button>
            ) : null}
            {sortedPlaces.length > 0 ? (
              <button type="button" aria-expanded={listOpen} onClick={() => setListOpen((on) => !on)} className={`${buttonClass} w-full justify-start bg-paper/95 shadow-sm @4xl:w-auto`}>
                <ListIcon />
                {t`まわりの場所`}
              </button>
            ) : null}
          </div>
          {stepper ? (
            <div role="group" aria-label={t`場所を順に見る`} className="order-1 flex shrink-0 items-center self-end rounded-full border border-ink bg-paper/95 shadow-sm @4xl:order-none @4xl:self-auto">
              <button type="button" onClick={() => goToStop(-1)} disabled={stopIndex === 0} aria-label={t`前の場所`} className={hit}>
                <ChevronLeftIcon />
              </button>
              <p aria-live="polite" className="min-w-[3.75rem] text-center text-lg font-bold tabular-nums">
                {stopIndex === -1 ? "－" : stopIndex + 1} / {stops.length}
              </p>
              <button type="button" onClick={() => goToStop(1)} disabled={stopIndex === stops.length - 1} aria-label={t`次の場所`} className={hit}>
                <ChevronIcon />
              </button>
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
}

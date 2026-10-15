"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Map as MapLibreMap } from "maplibre-gl";
import { WarningIcon } from "@/components/icons";
import type { SpotStatus } from "@/lib/content";
import { boundsOf, lineFeature, mapStyle, markerKind, nextStopId, routeLineLayers, zoomLimits } from "@/lib/map";
import { createMarkerElement } from "./MapMarker";
import { StopCard } from "./StopCard";

export interface MapStop {
  id: string;
  /** 1, 2, 3 ... in walking order; the number shown on the marker. */
  order: number;
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
}

const LINE_SOURCE = "route";
// Keep every stop clear of the buttons: zoom buttons at the top right, the chip at the top left,
// the two buttons and the credit line along the bottom.
const FIT = { padding: { top: 76, bottom: 112, left: 56, right: 72 }, maxZoom: 16, animate: false } as const;
const buttonClass =
  "tap-target inline-flex items-center justify-center gap-2 rounded-lg border-2 border-ink bg-paper px-3 text-lg font-bold text-ink hover:bg-surface";

/**
 * The trail map (WBS 3.2.1, 3.2.2): GSI tiles, the route line and one numbered button per stop.
 * Embedded, it does not capture one-finger drags, so the page keeps scrolling; the visible
 * "bigger map" button expands it to the full screen with full pan and zoom.
 */
export function TrailMap({ stops, approximate, draft }: { stops: MapStop[]; approximate: boolean; draft: boolean }) {
  const { t } = useLingui();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerEls = useRef(new Map<string, HTMLButtonElement>());
  const expandRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [relief, setRelief] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create the map once for these stops; remove it again on unmount (CLAUDE.md: map.remove()).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    const elements = markerEls.current;
    const markers: { remove: () => void }[] = [];

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        // MapLibre 6 runs its tile work in a separate worker file. Under Next.js the bundler must
        // emit that file, which this new URL(..., import.meta.url) pattern (from MapLibre's own
        // docs for Next.js 15 and later) does. Without it: "Worker failed to load".
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const points = stops.map((s) => s.position);
        const bounds = boundsOf(points);
        map = new ml.Map({
          container: containerRef.current,
          style: mapStyle(),
          bounds: bounds ?? undefined,
          fitBoundsOptions: FIT,
          minZoom: zoomLimits.min,
          maxZoom: zoomLimits.max,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: false },
        });
        map.touchZoomRotate.disableRotation();
        setInteractive(map, false);
        // A tile that cannot be fetched (weak signal) is normal, not an error to shout about: the
        // background shows and the tile is retried when the map moves.
        map.on("error", () => {});

        const next = nextStopId(stops);
        // Ready as soon as the style is: MapLibre's own "load" waits for every visible tile, which
        // on a weak mountain signal can take very long. The line, markers and buttons must not
        // wait for that; tiles simply fill in as they arrive. A single event can be missed, so
        // this is tried on every style update and on load, and runs only once.
        let started = false;
        const start = () => {
          if (started || cancelled || !map || !map.isStyleLoaded()) return;
          started = true;
          map.addSource(LINE_SOURCE, { type: "geojson", data: lineFeature(points) });
          for (const layer of routeLineLayers(LINE_SOURCE, approximate)) map.addLayer(layer);
          setLoaded(true);
        };
        map.on("styledata", start);
        map.on("load", start);
        start();

        for (const stop of stops) {
          const el = createMarkerElement({
            order: stop.order,
            label: stop.label,
            kind: markerKind(stop.stamped, stop.id === next),
            status: stop.status,
            onSelect: () => setSelectedId(stop.id),
          });
          elements.set(stop.id, el);
          markers.push(new ml.Marker({ element: el, anchor: "center" }).setLngLat([stop.position.lng, stop.position.lat]).addTo(map));
        }
        mapRef.current = map;
      } catch {
        // No WebGL, or the library failed to load: the list on the page still works.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      elements.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [stops, approximate]);

  // Embedded: no one-finger capture. Expanded: full interaction. Either way the map is resized.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setInteractive(map, expanded);
    map.resize();
    const bounds = boundsOf(stops.map((s) => s.position));
    if (bounds) map.fitBounds(bounds, FIT);
  }, [expanded, loaded, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded) map.setLayoutProperty("gsi-relief", "visibility", relief ? "visible" : "none");
  }, [relief, loaded]);

  // Mark the selected stop for screen readers and for the highlighted look.
  useEffect(() => {
    markerEls.current.forEach((el, id) => el.setAttribute("aria-pressed", String(id === selectedId)));
  }, [selectedId, loaded]);

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

  const selected = stops.find((s) => s.id === selectedId);

  if (failed) {
    return (
      <p className="rounded-xl border-2 border-line bg-surface p-4 text-lg">
        {t`この端末では地図を表示できません。下の一覧から場所を選べます。`}
      </p>
    );
  }

  return (
    <section
      aria-label={t`地図`}
      className={expanded ? "trail-map fixed inset-0 z-30 flex flex-col gap-3 bg-paper p-3" : "trail-map flex flex-col gap-3"}
    >
      {expanded ? (
        <div className="flex justify-end">
          <button ref={closeRef} type="button" onClick={() => setExpanded(false)} className={buttonClass}>
            {t`閉じる`}
          </button>
        </div>
      ) : null}

      <div
        className={
          expanded
            ? "relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-line"
            : "relative h-[28rem] overflow-hidden rounded-xl border-2 border-line"
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
          <p className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
            <span className="text-caution">
              <WarningIcon />
            </span>
            {t`仮の位置（未確認）`}
          </p>
        ) : null}

        <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
          <button type="button" onClick={() => zoom(1)} aria-label={t`拡大`} className={`${buttonClass} text-2xl`}>
            ＋
          </button>
          <button type="button" onClick={() => zoom(-1)} aria-label={t`縮小`} className={`${buttonClass} text-2xl`}>
            －
          </button>
        </div>

        <div className="absolute bottom-9 left-2 z-10">
          <button type="button" onClick={() => setRelief((on) => !on)} aria-pressed={relief} className={buttonClass}>
            {relief ? t`起伏を消す` : t`起伏を見る`}
          </button>
        </div>
      </div>

      {expanded ? null : (
        <button ref={expandRef} type="button" onClick={() => setExpanded(true)} className={`${buttonClass} w-full`}>
          {t`大きな地図で見る`}
        </button>
      )}

      {selected ? (
        <StopCard
          order={selected.order}
          name={selected.name}
          nameLang={selected.nameLang}
          status={selected.status}
          href={selected.href}
          draft={draft}
        />
      ) : null}
    </section>
  );
}

/** One-finger drag, wheel and keyboard are for the expanded map only; buttons and markers always work. */
function setInteractive(map: MapLibreMap, on: boolean) {
  const handlers = [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.boxZoom, map.keyboard];
  for (const handler of handlers) {
    if (on) handler.enable();
    else handler.disable();
  }
  if (on) map.touchZoomRotate.disableRotation();
}

"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { WarningIcon } from "@/components/icons";
import { clusterByPixels } from "@/lib/cluster";
import { areaCollection, estimateGroupBox, framePoints, groupLabelLines, MERGE_PX, revealedRouteId, spreadLabels, stopMergePx, type LabelBox, type MapScreenRoute } from "@/lib/map-screen";
import { groupOf } from "@/lib/places";
import { boundsOf, lineFeature, mapStyle, markerKind, nextStopId, routeLineLayers, zoomLimits, type Position } from "@/lib/map";
import type { MapSettings } from "@/lib/map-settings";
import { createClusterElement, createMarkerElement, createPinElement, createPlaceMarkerElement, createTagElement } from "./MapMarker";

// The map of the home screen (WBS 3.2.10). Each course is an outlined rectangle with a pin in the middle that
// carries its name. Zoom in over a course and its stops appear by themselves; choose a course and the others fold
// away while its path and stops show. Everything is drawn here; what is chosen and what the sheet says live in
// MapScreen.

const AREAS = "areas";
const DETAIL = "route-detail";
/** A course's navigation points (toilets, turns ...) show from this zoom on, once the course is open. */
const POINTS_ZOOM = 13;
/** From this zoom on, being "inside" a course opens it: its stops appear without anyone choosing it. */
const REVEAL_ZOOM = 11.3;
const EMPTY = { type: "FeatureCollection" as const, features: [] };
// Where the camera starts before any area is known: the middle of the trail (Osaka, Wakayama, Nara).
const START_CENTER: [number, number] = [135.35, 34.4];

const centerOf = (points: readonly Position[]): Position => ({
  lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
  lng: points.reduce((n, p) => n + p.lng, 0) / points.length,
});

export function MapScreenCanvas({
  routes,
  routeId,
  stopId,
  onSelectRoute,
  onSelectStop,
  coveredPx,
  coveredLeftPx = 0,
  settings,
  mergeStops,
}: {
  routes: MapScreenRoute[];
  routeId: string | null;
  stopId: string | null;
  onSelectRoute: (id: string) => void;
  onSelectStop: (routeId: string, stopId: string) => void;
  /** How much of the map's bottom the sheet and the tab bar cover right now: what is framed stays clear of it. */
  coveredPx: number;
  /** On a desktop: how much of the map's left side the panel covers, so what is framed stays clear of it. */
  coveredLeftPx?: number;
  settings: MapSettings;
  mergeStops: boolean;
}) {
  const { t, i18n } = useLingui();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const coveredRef = useRef(coveredPx);
  const leftRef = useRef(coveredLeftPx);
  const routesRef = useRef(routes);
  const selectRouteRef = useRef(onSelectRoute);
  const [mapGen, setMapGen] = useState(0);
  const [view, setView] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoId, setAutoId] = useState<string | null>(null);

  useEffect(() => {
    coveredRef.current = coveredPx;
    leftRef.current = coveredLeftPx;
    routesRef.current = routes;
    selectRouteRef.current = onSelectRoute;
  });

  const route = routes.find((r) => r.id === routeId) ?? null;
  // The course shown on its own: the chosen one, or else the one the visitor has zoomed into (the others fold away).
  const focus = route ?? routes.find((r) => r.id === autoId) ?? null;
  const draftShown = focus ? focus.draft || focus.area?.verified === false : routes.some((r) => r.area && !r.area.verified);

  // Keep what is framed above the sheet and clear of the buttons (menu on the left, zoom on the right).
  const padding = () => ({ top: 96, left: 36 + leftRef.current, right: 72, bottom: coveredRef.current + 28 });

  // Create the map once for these settings; remove it again on unmount (CLAUDE.md: map.remove()).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        setReady(false);
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        map = new ml.Map({
          container: containerRef.current,
          style: mapStyle(settings),
          center: START_CENTER,
          zoom: 8.6,
          minZoom: zoomLimits.min,
          maxZoom: zoomLimits.max,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: false },
        });
        map.touchZoomRotate.disableRotation();
        map.on("error", () => {});
        map.on("moveend", () => {
          if (!map) return;
          const c = map.getCenter();
          setAutoId(revealedRouteId(routesRef.current, { lat: c.lat, lng: c.lng }, map.getZoom(), REVEAL_ZOOM));
          setView((v) => v + 1);
        });

        let started = false;
        const start = () => {
          if (started || cancelled || !map || !map.isStyleLoaded()) return;
          started = true;
          map.addSource(AREAS, { type: "geojson", data: EMPTY });
          map.addLayer({ id: `${AREAS}-fill`, type: "fill", source: AREAS, paint: { "fill-color": "#cc6256", "fill-opacity": ["case", ["get", "selected"], 0.06, 0.16] } });
          map.addLayer({ id: `${AREAS}-line`, type: "line", source: AREAS, paint: { "line-color": "#a8362b", "line-width": ["case", ["get", "selected"], 3, 2.2], "line-opacity": 0.95 } });
          map.addSource(DETAIL, { type: "geojson", data: EMPTY });
          for (const layer of routeLineLayers(DETAIL, false)) map.addLayer(layer);
          map.on("click", `${AREAS}-fill`, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") selectRouteRef.current(id);
          });
          map.on("mouseenter", `${AREAS}-fill`, () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", `${AREAS}-fill`, () => (map!.getCanvas().style.cursor = ""));
          setReady(true);
        };
        map.on("styledata", start);
        map.on("load", start);
        start();

        mapRef.current = map;
        mlRef.current = ml;
        setMapGen((g) => g + 1);
      } catch {
        // No WebGL, or the library failed to load: the list in the sheet still works.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [settings]);

  // What is drawn: the rectangles (all of them, or only the chosen course) and the shown course's path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(AREAS) as GeoJSONSource | undefined)?.setData(areaCollection(routes, focus?.id ?? null));
    const points = focus?.line ?? focus?.stops?.map((s) => s.position) ?? null;
    (map.getSource(DETAIL) as GeoJSONSource | undefined)?.setData(points && points.length > 1 ? lineFeature(points) : EMPTY);
  }, [ready, routes, routeId, focus, mapGen]);

  // Where the camera goes: all the areas at first, a chosen course when there is one.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const points = route ? framePoints(route) : routes.flatMap((r) => (r.area ? framePoints(r) : []));
    const bounds = boundsOf(points);
    if (bounds) map.fitBounds(bounds, { padding: padding(), maxZoom: route ? 15 : 11, duration: 600 });
  }, [ready, routeId, mapGen]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chosen stop is brought into view above the sheet.
  useEffect(() => {
    const map = mapRef.current;
    const stop = focus?.stops?.find((s) => s.id === stopId);
    if (!map || !ready || !stop) return;
    map.easeTo({ center: [stop.position.lng, stop.position.lat], zoom: Math.max(map.getZoom(), 15), padding: padding(), duration: 500 });
  }, [ready, stopId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The markers: a pin for each course (with its name once zoomed in, merged into groups while zoomed out), and
  // the numbered stops of the course that is shown.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    const live: { remove: () => void }[] = [];
    const put = (el: HTMLElement, at: Position, anchor: "center" | "bottom" = "center") =>
      live.push(new ml.Marker({ element: el, anchor }).setLngLat([at.lng, at.lat]).addTo(map));
    const pixel = (id: string, at: Position) => {
      const p = map.project([at.lng, at.lat]);
      return { id, x: p.x, y: p.y };
    };
    const zoomTo = (points: readonly Position[]) => {
      const bounds = boundsOf(points);
      if (bounds) map.fitBounds(bounds, { padding: padding(), maxZoom: 17 });
    };

    // Pins: all of them while nothing is open. Once a course is open the others fold away; an opened course
    // with no stops of its own to show keeps its pin, so there is still something to read and press.
    const pinned = route ? [] : focus ? (focus.stops?.length ? [] : [focus]) : routes.filter((r) => r.area);
    const byId = new Map(pinned.map((r) => [r.id, r]));
    // The map's own rule, whatever the settings: pins closer than their size merge into one group. Every course keeps
    // its name: a pin carries its own name, and a group lists the names of the courses inside it.
    const sideways = pinned.some((r) => r.nameLang !== "ja");
    const groups = clusterByPixels(pinned.map((r) => pixel(r.id, r.area as Position)), sideways ? MERGE_PX.namedPin : MERGE_PX.tag);
    const merged: { box: LabelBox; node: HTMLElement }[] = [];
    for (const ids of groups) {
      const members = ids.map((id) => byId.get(id)!);
      if (members.length === 1) {
        const r = members[0]!;
        const order = r.order;
        const name = r.name;
        const common = { number: String(r.order), label: t`${order}. ${name}`, soon: r.status === "soon", onSelect: () => onSelectRoute(r.id) };
        put(r.nameLang === "ja" ? createTagElement({ ...common, name }) : createPinElement({ ...common, name }), r.area as Position, "bottom");
      } else {
        const sorted = [...members].sort((x, y) => x.order - y.order);
        const orders = sorted.map((m) => m.order);
        const text = `${orders[0]}–${orders[orders.length - 1]}`;
        const lines = sorted.map((m) => `${m.order}. ${m.name}`);
        // As many names as fit in the visible height; the rest are in the sheet's list.
        // Two columns of groups fit side by side, so each group may use its share of the height.
        const rows = Math.max(1, Math.ceil(groups.filter((g) => g.length > 1).length / 2));
        // (The size estimate is generous, so the share is widened a little.)
        const room = (((containerRef.current?.clientHeight ?? 700) - coveredRef.current - 100 - 16) / rows) * 1.35;
        const { lines: shown, more } = groupLabelLines(lines, room);
        const node = createClusterElement({
          text,
          label: t`区間 ${text} がここに集まっています。押すと拡大します`,
          kind: "stops",
          names: { lines: shown, more: more > 0 ? t`ほか ${more} 区間` : null },
          onSelect: () => zoomTo(members.flatMap((m) => framePoints(m))),
        });
        const middle = map.project([centerOf(members.map((m) => m.area as Position)).lng, centerOf(members.map((m) => m.area as Position)).lat]);
        merged.push({ box: { id: ids.join(","), x: middle.x, y: middle.y, ...estimateGroupBox(more > 0 ? [...shown, ""] : shown) }, node });
      }
    }
    // The labels of merged groups must not cover each other or sit under the buttons and the sheet: every name stays readable.
    if (merged.length > 0) {
      const size = containerRef.current;
      const spread = spreadLabels(
        merged.map((m) => m.box),
        { left: 8 + leftRef.current, top: 100, right: (size?.clientWidth ?? 360) - 8, bottom: (size?.clientHeight ?? 700) - coveredRef.current - 8 },
      );
      merged.forEach((m, i) => {
        const at = map.unproject([spread[i]!.x, spread[i]!.y]);
        put(m.node, { lat: at.lat, lng: at.lng });
      });
    }

    if (focus?.stops) {
      const next = nextStopId(focus.stops);
      const stopById = new Map(focus.stops.map((s) => [s.id, s]));
      // Stops that touch always merge; the accessibility choice only makes them merge earlier.
      const stopGroups = clusterByPixels(focus.stops.map((s) => pixel(s.id, s.position)), stopMergePx(mergeStops));
      for (const ids of stopGroups) {
        const members = ids.map((id) => stopById.get(id)!);
        if (members.length === 1) {
          const s = members[0]!;
          const el = createMarkerElement({
            order: s.order,
            label: s.label,
            kind: markerKind(s.stamped, s.id === next),
            status: s.status,
            onSelect: () => onSelectStop(focus.id, s.id),
          });
          el.setAttribute("aria-pressed", String(s.id === stopId));
          put(el, s.position);
        } else {
          const orders = members.map((m) => m.order);
          const text = `${Math.min(...orders)}–${Math.max(...orders)}`;
          put(
            createClusterElement({
              text,
              label: t`スタンプの場所 ${text} がここに集まっています。押すと拡大します`,
              kind: "stops",
              onSelect: () => zoomTo(members.map((m) => m.position)),
            }),
            centerOf(members.map((m) => m.position)),
          );
        }
      }
    }

    // The course's other points (toilets, turns, viewpoints), once zoomed in on it.
    if (focus && focus.points.length > 0 && map.getZoom() >= POINTS_ZOOM) {
      for (const p of focus.points) {
        put(
          createPlaceMarkerElement({
            group: groupOf(p.category),
            label: p.name,
            closed: false,
            onSelect: () => map.easeTo({ center: [p.position.lng, p.position.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 }),
          }),
          p.position,
        );
      }
    }

    return () => live.forEach((m) => m.remove());
    // `t` changes only with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mapGen, view, routes, routeId, autoId, stopId, mergeStops]);

  const zoom = (delta: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    const options = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? { duration: 0 } : undefined;
    if (delta > 0) map.zoomIn(options);
    else map.zoomOut(options);
  };

  if (failed) {
    return <p className="absolute inset-x-4 top-20 z-10 rounded-2xl bg-surface p-4 text-lg">{t`この端末では地図を表示できません。下の一覧から区間を選べます。`}</p>;
  }

  return (
    <>
      <div className="absolute inset-0" lang={i18n.locale}>
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {ready ? null : <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-lg">{t`地図を読み込み中…`}</p>}

      {draftShown ? (
        <p style={{ marginLeft: coveredLeftPx }} className="absolute left-3 top-16 z-[4] flex max-w-[calc(100%-6rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
          <span className="text-caution">
            <WarningIcon />
          </span>
          {t`見本の位置（目安です）`}
        </p>
      ) : null}

      <div className="absolute right-3 top-16 z-[4] flex flex-col gap-2">
        {(["＋", "－"] as const).map((sign) => (
          <button
            key={sign}
            type="button"
            onClick={() => zoom(sign === "＋" ? 1 : -1)}
            aria-label={sign === "＋" ? t`拡大` : t`縮小`}
            className="tap-target inline-flex items-center justify-center rounded-lg border-2 border-ink bg-paper px-3 text-2xl font-bold text-ink hover:bg-surface"
          >
            {sign}
          </button>
        ))}
      </div>
    </>
  );
}

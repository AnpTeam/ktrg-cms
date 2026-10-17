"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { WarningIcon } from "@/components/icons";
import { clusterByPixels } from "@/lib/cluster";
import { areaCollection, framePoints, type HomeRoute } from "@/lib/home-map";
import { boundsOf, lineFeature, mapStyle, markerKind, nextStopId, routeLineLayers, zoomLimits, type Position } from "@/lib/map";
import type { MapSettings } from "@/lib/map-settings";
import { createAreaElement, createClusterElement, createMarkerElement } from "./MapMarker";

// The map of the home screen (WBS 3.2.10). Overview: one round area per course, each with its number. Choose a
// course and the other areas fold away; that course shows its path and its numbered stops. Everything is drawn
// here; what is chosen and what the sheet says live in HomeMapView.

const AREAS = "areas";
const DETAIL = "route-detail";
const CLUSTER_PX = 50;
const EMPTY = { type: "FeatureCollection" as const, features: [] };
// Where the camera starts before any area is known: the middle of the trail (Osaka, Wakayama, Nara).
const START_CENTER: [number, number] = [135.35, 34.4];

const centerOf = (points: readonly Position[]): Position => ({
  lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
  lng: points.reduce((n, p) => n + p.lng, 0) / points.length,
});

export function HomeMapCanvas({
  routes,
  routeId,
  stopId,
  onSelectRoute,
  onSelectStop,
  coveredPx,
  settings,
  mergeStops,
}: {
  routes: HomeRoute[];
  routeId: string | null;
  stopId: string | null;
  onSelectRoute: (id: string) => void;
  onSelectStop: (id: string) => void;
  /** How much of the map's bottom the sheet and the tab bar cover right now: what is framed stays clear of it. */
  coveredPx: number;
  settings: MapSettings;
  mergeStops: boolean;
}) {
  const { t } = useLingui();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const coveredRef = useRef(coveredPx);
  const selectRouteRef = useRef(onSelectRoute);
  const [mapGen, setMapGen] = useState(0);
  const [view, setView] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    coveredRef.current = coveredPx;
    selectRouteRef.current = onSelectRoute;
  });

  const route = routes.find((r) => r.id === routeId) ?? null;
  const draftShown = route ? route.draft || route.area?.verified === false : routes.some((r) => r.area && !r.area.verified);

  // Keep what is framed above the sheet and clear of the buttons (menu on the left, zoom on the right).
  const padding = () => ({ top: 96, left: 36, right: 72, bottom: coveredRef.current + 28 });

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
        map.on("moveend", () => setView((v) => v + 1));

        let started = false;
        const start = () => {
          if (started || cancelled || !map || !map.isStyleLoaded()) return;
          started = true;
          map.addSource(AREAS, { type: "geojson", data: EMPTY });
          map.addLayer({ id: `${AREAS}-fill`, type: "fill", source: AREAS, paint: { "fill-color": "#cc6256", "fill-opacity": ["case", ["get", "selected"], 0.1, 0.24] } });
          map.addLayer({ id: `${AREAS}-line`, type: "line", source: AREAS, paint: { "line-color": "#a8362b", "line-width": ["case", ["get", "selected"], 3, 2], "line-opacity": 0.9 } });
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

  // What is drawn: the areas (all of them, or only the chosen course) and the chosen course's path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(AREAS) as GeoJSONSource | undefined)?.setData(areaCollection(routes, routeId));
    const points = route?.line ?? route?.stops?.map((s) => s.position) ?? null;
    (map.getSource(DETAIL) as GeoJSONSource | undefined)?.setData(points && points.length > 1 ? lineFeature(points) : EMPTY);
  }, [ready, routes, routeId, route, mapGen]);

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
    const stop = route?.stops?.find((s) => s.id === stopId);
    if (!map || !ready || !stop) return;
    map.easeTo({ center: [stop.position.lng, stop.position.lat], zoom: Math.max(map.getZoom(), 15), padding: padding(), duration: 500 });
  }, [ready, stopId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The markers: numbered areas (merged where they would overlap) or, for a chosen course, its stops.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    const live: { remove: () => void }[] = [];
    const put = (el: HTMLElement, at: Position) =>
      live.push(new ml.Marker({ element: el, anchor: "center" }).setLngLat([at.lng, at.lat]).addTo(map));
    const pixel = (id: string, at: Position) => {
      const p = map.project([at.lng, at.lat]);
      return { id, x: p.x, y: p.y };
    };
    const zoomTo = (points: readonly Position[]) => {
      const bounds = boundsOf(points);
      if (bounds) map.fitBounds(bounds, { padding: padding(), maxZoom: 17 });
    };

    if (!route) {
      const withArea = routes.filter((r) => r.area);
      const byId = new Map(withArea.map((r) => [r.id, r]));
      for (const ids of clusterByPixels(withArea.map((r) => pixel(r.id, r.area as Position)), CLUSTER_PX)) {
        const members = ids.map((id) => byId.get(id)!);
        if (members.length === 1) {
          const r = members[0]!;
          const name = r.name;
          const order = r.order;
          put(
            createAreaElement({ text: String(r.order), label: t`${order}. ${name}`, soon: r.status === "soon", onSelect: () => onSelectRoute(r.id) }),
            r.area as Position,
          );
        } else {
          const orders = members.map((m) => m.order);
          const text = `${Math.min(...orders)}–${Math.max(...orders)}`;
          put(
            createClusterElement({
              text,
              label: t`区間 ${text} がここに集まっています。押すと拡大します`,
              kind: "stops",
              onSelect: () => zoomTo(members.flatMap((m) => framePoints(m))),
            }),
            centerOf(members.map((m) => m.area as Position)),
          );
        }
      }
    } else if (route.stops) {
      const next = nextStopId(route.stops);
      const byId = new Map(route.stops.map((s) => [s.id, s]));
      const groups = mergeStops ? clusterByPixels(route.stops.map((s) => pixel(s.id, s.position)), CLUSTER_PX) : route.stops.map((s) => [s.id]);
      for (const ids of groups) {
        const members = ids.map((id) => byId.get(id)!);
        if (members.length === 1) {
          const s = members[0]!;
          const el = createMarkerElement({
            order: s.order,
            label: s.label,
            kind: markerKind(s.stamped, s.id === next),
            status: s.status,
            onSelect: () => onSelectStop(s.id),
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

    return () => live.forEach((m) => m.remove());
    // `t` changes only with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mapGen, view, routes, routeId, stopId, mergeStops]);

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
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {ready ? null : <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-lg">{t`地図を読み込み中…`}</p>}

      {draftShown ? (
        <p className="absolute left-3 top-16 z-10 flex max-w-[calc(100%-6rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
          <span className="text-caution">
            <WarningIcon />
          </span>
          {t`見本の位置（目安です）`}
        </p>
      ) : null}

      <div className="absolute right-3 top-16 z-10 flex flex-col gap-2">
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

"use client";

import { mapMemory, type MapCamera } from "@/lib/map-memory";
import { MapHelp } from "./MapHelp";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { MinusIcon, PlusIcon, WarningIcon } from "@/components/icons";
import { clusterByPixels } from "@/lib/cluster";
import { pinPhotoSrc } from "@/lib/pin-photo";
import { areaCollection, courseDotState, COURSE_DOT_PX, estimateGroupBox, framePoints, groupLabelLines, MERGE_PX, namesThatFit, revealedRouteId, SAME_PLACE_M, samePlaceOnly, spreadLabels, spreadMeters, stopMergePx, type LabelBox, type MapScreenPoint, type MapScreenRoute, type MapScreenStop } from "@/lib/map-screen";
import { defaultLayers, moundStops, offeredLayers, type MapLayer } from "@/lib/map-layers";
import { groupOf } from "@/lib/places";
import { PlaceGroupPicture } from "@/components/PlaceIcon";
import { useGroupNames } from "./PlacesPanel";
import { mapStyleSource } from "@/lib/large-map-style";
import { boundsOf, lineFeature, markerKind, nextStopId, pinScale, PIN_NUMBER_MIN_ZOOM, routeLineLayers, sideLineCollection, sideLineLayers, zoomLimits, type Position } from "@/lib/map";
import type { MapSettings } from "@/lib/map-settings";
import { getRouteLine } from "@/lib/navigation/line-client";
import { useCursorMarker } from "./useCursorMarker";
import { createClusterElement, createMarkerElement, createPinElement, createPlaceMarkerElement, createCourseDot } from "./MapMarker";
import { MapPickList } from "./MapPickList";

// The map of the home screen (WBS 3.2.10). Each course is an outlined rectangle with a pin in the middle that
// carries its name. Zoom in over a course and its stops appear by themselves; choose a course and the others fold
// away while its path and stops show. Everything is drawn here; what is chosen and what the sheet says live in
// MapScreen.

const AREAS = "areas";
const DETAIL = "route-detail";
/** Side trips (寄り道) of the shown course: thin dashed blue lines under its path. */
const SIDE = "route-side";
/** The walking path from OpenRouteService while navigating off the course line. */
const GUIDE = "nav-guide";
/** A course's navigation points (toilets, turns ...) show from this zoom on, once the course is open. */
const POINTS_ZOOM = 13;
/** From this zoom on, being "inside" a course opens it: its stops appear without anyone choosing it. */
const REVEAL_ZOOM = 11.3;
/** From this zoom on, a course's name shows beside its dot, where there is room. Below REVEAL_ZOOM, or no name would ever show. */
const NAME_ZOOM = 10;
/** A course dot this close to the visible part of the map is kept inside it, in px. */
const DOT_PULL_PX = 40;
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
  onSelectMound,
  onSelectPlace,
  focusPlaceId = null,
  startCamera = null,
  coveredPx,
  coveredLeftPx = 0,
  controlsTopPx = 0,
  settings,
  mergeStops,
  user = null,
  towardsDeg = null,
  far = false,
  resumeTick = 0,
  guide = null,
}: {
  routes: MapScreenRoute[];
  routeId: string | null;
  stopId: string | null;
  onSelectRoute: (id: string) => void;
  onSelectStop: (routeId: string, stopId: string) => void;
  /** A sutra mound chosen from the 経塚 pins (outside of its course): the page shows it without the course's number. */
  onSelectMound: (routeId: string, stopId: string) => void;
  /** A nearby place (a shop, a toilet ...) chosen on the map: the page shows it in the sheet, as it does a stop. */
  onSelectPlace: (place: MapScreenPoint) => void;
  /** A place of the open course to bring into view and open once, when the page was asked for it. */
  focusPlaceId?: string | null;
  /** The view to come back to; the course and stop it shows are then not framed again until they change. */
  startCamera?: MapCamera | null;
  /** How much of the map's bottom the sheet and the tab bar cover right now: what is framed stays clear of it. */
  coveredPx: number;
  /** On a desktop: how much of the map's left side the panel covers, so what is framed stays clear of it. */
  coveredLeftPx?: number;
  /** How far down the screen something sits over the top of the map (the navigation banner): the buttons go below it. */
  controlsTopPx?: number;
  settings: MapSettings;
  mergeStops: boolean;
  /** While navigating: where the phone is (on this phone only), drawn as a dot, and which way the visitor walks. */
  user?: { lat: number; lng: number; headingDeg?: number } | null;
  /** While navigating: the way to the next stop (degrees from north), drawn as an arrow on the visitor's dot. */
  towardsDeg?: number | null;
  /** Far from the course: the map shows the course, not the visitor's own town. */
  far?: boolean;
  /** Goes up each time 「ナビにもどる」 is pressed. */
  resumeTick?: number;
  /** While navigating off the course line: the walking path being followed, as [lng, lat] points. */
  guide?: readonly (readonly [number, number, number?])[] | null;
}) {
  const userMarker = useRef<Marker | null>(null);
  // Following the visitor: the map stays centred on them, turned so the way they walk is up. Moving the map by hand
  // stops it (and turns north back up); the button starts it again.
  const [follow, setFollow] = useState(false);
  const followRef = useRef(false);
  const setFollowing = (on: boolean) => {
    followRef.current = on;
    setFollow(on);
  };
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
  // The list that opens when pins stand on the same spot.
  const selectPlaceRef = useRef(onSelectPlace);
  useEffect(() => {
    selectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);
  const [pick, setPick] = useState<MapScreenStop[] | null>(null);
  const [autoId, setAutoId] = useState<string | null>(null);
  // The pin whose name is showing. Names stay out of sight until a pin is tapped once (a second tap opens it), except for
  // the courses alone in Japanese, where the tags are narrow enough to show all together.
  const [revealed, setRevealed] = useState<string | null>(null);
  // What is switched on along the top: the courses, the sutra mounds, the kinds of places.
  const [layers, setLayers] = useState<ReadonlySet<MapLayer>>(defaultLayers);
  const groupNames = useGroupNames();
  const toggleLayer = (layer: MapLayer) => {
    setRevealed(null);
    setLayers((now) => {
      const next = new Set(now);
      if (!next.delete(layer)) next.add(layer);
      return next;
    });
  };

  useEffect(() => {
    coveredRef.current = coveredPx;
    leftRef.current = coveredLeftPx;
    routesRef.current = routes;
    selectRouteRef.current = onSelectRoute;
  });

  const route = routes.find((r) => r.id === routeId) ?? null;
  // The course shown on its own: the chosen one, or else the one the visitor has zoomed into (the others fold away).
  const shown = route ?? routes.find((r) => r.id === autoId) ?? null;
  // Paths come on demand (see MapScreenRoute.hasLine) and are kept, so choosing a course again costs nothing.
  const [lines, setLines] = useState<Record<string, Position[]>>({});
  const fetched = shown ? lines[shown.id] : undefined;
  const focus = useMemo(() => (shown && !shown.line && fetched ? { ...shown, line: fetched } : shown), [shown, fetched]);
  const wanted = shown && shown.hasLine && !shown.line && !lines[shown.id] ? shown.id : null;
  useEffect(() => {
    if (!wanted) return;
    let stale = false;
    // Shared with the elevation chart and the navigation (one request per course).
    void getRouteLine(wanted).then((coords) => {
      if (!stale && coords) setLines((l) => ({ ...l, [wanted]: coords.map(([lng, lat]) => ({ lat, lng })) })); // no path drawn when it fails; the stops still show
    });
    return () => {
      stale = true;
    };
  }, [wanted]);
  const draftShown = focus ? focus.draft || focus.area?.verified === false : routes.some((r) => r.area && !r.area.verified);

  // Keep what is framed above the sheet and clear of the buttons (menu on the left, zoom on the right).
  const padding = () => ({ top: 144, left: 36 + leftRef.current, right: 72, bottom: coveredRef.current + 28 });

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
          style: mapStyleSource(settings, i18n.locale),
          center: startCamera?.center ?? START_CENTER,
          zoom: startCamera?.zoom ?? 8.6,
          // Tilted a little from the start, so the mountains read as a landscape. Three fingers change it (MapHelp).
          pitch: startCamera?.pitch ?? 45,
          bearing: startCamera?.bearing ?? 0,
          minZoom: zoomLimits.min,
          maxZoom: zoomLimits.max,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: false },
        });
        // The saved centre is measured inside the padding it was saved with.
        if (startCamera) map.setPadding(startCamera.padding);
        map.touchZoomRotate.disableRotation();
        // A drag by the visitor (not the camera following them) ends following, and north goes back up.
        map.on("dragstart", () => {
          if (!followRef.current) return;
          followRef.current = false;
          setFollow(false);
          map?.easeTo({ bearing: 0, duration: 400 });
        });
        map.on("error", () => {});
        // Touching the map itself (not a pin) puts away the list.
        map.on("click", (e) => {
          if ((e.originalEvent.target as HTMLElement | null)?.closest(".place-marker, .map-marker, .map-cluster, .map-dot, .map-pin")) return;
          setPick(null);
          setRevealed(null);
        });
        // The numbered pins are smaller when zoomed out (the markers read this size from the map's own element).
        const sizePins = () => {
          containerRef.current?.style.setProperty("--pin", String(pinScale(map!.getZoom())));
          containerRef.current?.toggleAttribute("data-far", map!.getZoom() < PIN_NUMBER_MIN_ZOOM);
        };
        map.on("zoom", sizePins);
        sizePins();
        map.on("moveend", () => {
          if (!map) return;
          const c = map.getCenter();
          mapMemory.camera = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
          setAutoId(revealedRouteId(routesRef.current, { lat: c.lat, lng: c.lng }, map.getZoom(), REVEAL_ZOOM));
          setView((v) => v + 1);
        });

        let started = false;
        const start = () => {
          if (started || cancelled || !map || !map.isStyleLoaded()) return;
          started = true;
          map.addSource(AREAS, { type: "geojson", data: EMPTY });
          map.addLayer({ id: `${AREAS}-fill`, type: "fill", source: AREAS, paint: { "fill-color": "#cc6256", "fill-opacity": ["case", ["get", "selected"], 0.06, 0.05] } });
          map.addLayer({ id: `${AREAS}-line`, type: "line", source: AREAS, paint: { "line-color": "#a8362b", "line-width": ["case", ["get", "selected"], 3, 1.5], "line-opacity": ["case", ["get", "selected"], 0.95, 0.35] } });
          map.addSource(SIDE, { type: "geojson", data: EMPTY });
          for (const layer of sideLineLayers(SIDE)) map.addLayer(layer);
          map.addSource(DETAIL, { type: "geojson", data: EMPTY });
          for (const layer of routeLineLayers(DETAIL, false)) map.addLayer(layer);
          map.addSource(GUIDE, { type: "geojson", data: EMPTY });
          map.addLayer({ id: `${GUIDE}-line`, type: "line", source: GUIDE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1d4ed8", "line-width": 4, "line-dasharray": [1.5, 1.5] } });
          map.on("click", `${AREAS}-fill`, (e) => {
            // A pin or tag standing on the area is the target, not the area under it.
            if ((e.originalEvent.target as HTMLElement | null)?.closest(".place-marker, .map-marker, .map-cluster, .map-dot, .map-pin")) return;
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
  }, [settings, i18n.locale]); // eslint-disable-line react-hooks/exhaustive-deps -- startCamera only sets the first view

  // What is drawn: the rectangles (all of them, or only the chosen course) and the shown course's path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(AREAS) as GeoJSONSource | undefined)?.setData(layers.has("courses") || focus ? areaCollection(routes, focus?.id ?? null) : EMPTY);
    const points = focus?.line ?? focus?.stops?.map((s) => s.position) ?? null;
    (map.getSource(DETAIL) as GeoJSONSource | undefined)?.setData(points && points.length > 1 ? lineFeature(points) : EMPTY);
    (map.getSource(SIDE) as GeoJSONSource | undefined)?.setData(layers.has("side") && focus?.sideLines?.length ? sideLineCollection(focus.sideLines) : EMPTY);
  }, [ready, routes, routeId, focus, mapGen, layers]);

  // Navigation: the walking path off the course line, and the visitor's position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(GUIDE) as GeoJSONSource | undefined)?.setData(guide && guide.length > 1 ? lineFeature(guide.map(([lng, lat]) => ({ lat, lng }))) : EMPTY);
  }, [ready, guide, mapGen]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      // The dot, with an arrow on its edge pointing to the next stop. Turned with the map, so it stays true when the
      // map is turned to the walking direction.
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.innerHTML =
        '<svg viewBox="0 0 64 64" class="size-16 text-brand drop-shadow-lg"><path d="M32 2 L49 28 Q32 19 15 28 Z" fill="currentColor" stroke="white" stroke-width="2.5" stroke-linejoin="round" /><circle cx="32" cy="34" r="10" class="fill-ink stroke-paper" stroke-width="3.5" /></svg>';
      userMarker.current = new ml.Marker({ element: el, rotationAlignment: "map" }).setLngLat([user.lng, user.lat]).addTo(map);
    } else userMarker.current.setLngLat([user.lng, user.lat]);
    userMarker.current.setRotation(towardsDeg ?? 0);
    userMarker.current.getElement().querySelector("path")?.setAttribute("visibility", towardsDeg === null ? "hidden" : "visible");
  }, [ready, user, towardsDeg, mapGen]);

  useEffect(
    () => () => {
      userMarker.current?.remove();
      userMarker.current = null;
    },
    [mapGen],
  );

  useCursorMarker(mapRef, mlRef, mapGen, ready);

  // Following only means something while there is a position (a navigation runs).
  const following = follow && user !== null && !far;

  // While following: keep the visitor in the middle, the way they walk up.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !following || !user) return;
    map.easeTo({
      center: [user.lng, user.lat],
      bearing: user.headingDeg ?? map.getBearing(),
      zoom: Math.max(map.getZoom(), 16),
      padding: padding(),
      duration: 600,
    });
  }, [ready, following, user]);

  // Navigation ended: north up again (a new navigation starts without following until the button is pressed).
  const hasUser = user !== null;
  // Adjusted while rendering (the pattern React recommends for state that follows another value).
  const [seenUser, setSeenUser] = useState(hasUser);
  // Bumped when a navigation ends: the camera frames the course again instead of staying zoomed in where the visitor was.
  const [navEnds, setNavEnds] = useState(0);
  if (seenUser !== hasUser) {
    setSeenUser(hasUser);
    if (!hasUser) setNavEnds((n) => n + 1);
    // A navigation just began: the map follows the visitor from the start (the recenter button brings it back after a drag).
    setFollow(hasUser);
  }
  useEffect(() => {
    followRef.current = hasUser;
    if (!hasUser) mapRef.current?.easeTo({ bearing: 0, duration: 400 });
  }, [hasUser]);

  const startFollowing = () => setFollowing(true);

  // 「ナビにもどる」: back on the walk, or on the course when it is far away.
  const [seenResume, setSeenResume] = useState(resumeTick);
  if (seenResume !== resumeTick) {
    setSeenResume(resumeTick);
    setFollow(true);
    if (far) setNavEnds((n) => n + 1);
  }
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  // The compass: its needle shows where north is, and a tap lays the map flat or tilts it again.
  const [camera, setCamera] = useState({ bearing: 0, pitch: 45 });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const read = () => setCamera({ bearing: map.getBearing(), pitch: map.getPitch() });
    read();
    map.on("rotate", read);
    map.on("pitch", read);
    return () => {
      map.off("rotate", read);
      map.off("pitch", read);
    };
  }, [ready, mapGen]);
  const flat = camera.pitch < 5;
  const toggleTilt = () => mapRef.current?.easeTo({ pitch: flat ? 45 : 0, ...(following ? {} : { bearing: 0 }), duration: 400 });

  // Back from another page, the view stays as it was until the visitor chooses something else (undefined: nothing kept).
  const keptRoute = useRef(startCamera ? routeId : undefined);
  const keptStop = useRef(startCamera ? stopId : undefined);

  // Where the camera goes: all the areas at first, a chosen course when there is one.
  useEffect(() => {
    const map = mapRef.current;
    if (keptRoute.current === routeId && navEnds === 0) {
      if (ready) map?.fire("moveend"); // no move happens, and the pins read the view from this event
      return;
    }
    keptRoute.current = undefined;
    if (!map || !ready) return;
    const points = route ? framePoints(route.line || !lines[route.id] ? route : { ...route, line: lines[route.id] ?? null }) : routes.flatMap((r) => (r.area ? framePoints(r) : []));
    const bounds = boundsOf(points);
    if (bounds) map.fitBounds(bounds, { padding: padding(), maxZoom: route ? 15 : 11, duration: 600 });
  }, [ready, routeId, mapGen, navEnds, routeId ? lines[routeId] : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the framing above: 「ナビにもどる」 may have just brought the course back, and the walker comes first.
  useEffect(() => {
    if (resumeTick === 0 || !user || far) return;
    const map = mapRef.current;
    map?.easeTo({ center: [user.lng, user.lat], zoom: Math.max(map.getZoom(), 16), padding: padding(), duration: 700 });
  }, [resumeTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // A place asked for in the address ("show on map" from a route's nearby places): after the course has been framed, the map
  // moves to it, zoomed in enough for its pin to show, and its popup opens.
  useEffect(() => {
    const map = mapRef.current;
    const place = focusPlaceId ? focus?.points.find((p) => p.id === focusPlaceId) : null;
    if (!map || !ready || !place) return;
    const timer = setTimeout(() => {
      map.easeTo({ center: [place.position.lng, place.position.lat], zoom: Math.max(map.getZoom(), 17), padding: padding(), duration: 600 });
      selectPlaceRef.current(place);
    }, 900);
    return () => clearTimeout(timer);
  }, [ready, focusPlaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chosen stop is brought into view above the sheet.
  useEffect(() => {
    if (keptStop.current === stopId) return;
    keptStop.current = undefined;
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
    const pinned = route ? [] : focus ? (focus.stops?.length ? [] : [focus]) : layers.has("courses") ? routes.filter((r) => r.area) : [];
    const byId = new Map(pinned.map((r) => [r.id, r]));
    // Courses merge only when the visitor chose 「近い場所をまとめて表示する」: by default each keeps its own dot. When merging,
    // a group lists the names of the courses inside it.
    const groups = mergeStops ? clusterByPixels(pinned.map((r) => pixel(r.id, r.area as Position)), MERGE_PX.pin) : pinned.map((r) => [r.id]);
    const merged: { box: LabelBox; node: HTMLElement }[] = [];
    const dots: { route: MapScreenRoute; box: LabelBox }[] = [];
    for (const ids of groups) {
      const members = ids.map((id) => byId.get(id)!);
      if (members.length === 1) {
        const r = members[0]!;
        dots.push({ route: r, box: { ...pixel(r.id, r.area as Position), w: COURSE_DOT_PX, h: COURSE_DOT_PX } });
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
    // Dots near each other are pushed just far enough apart to read and tap; zoomed in they no longer touch, so they sit on
    // their own spots. Dots in view stay in the part of the map that can be seen; a dot well off it stays off it, or panning
    // would gather every far course at the edge.
    const size = containerRef.current;
    const seen = { left: 8 + leftRef.current, top: 100, right: (size?.clientWidth ?? 360) - 64, bottom: (size?.clientHeight ?? 700) - coveredRef.current - 8 }; // right: clear of the zoom buttons
    const near = (b: LabelBox) => b.x > seen.left - DOT_PULL_PX && b.x < seen.right + DOT_PULL_PX && b.y > seen.top - DOT_PULL_PX && b.y < seen.bottom + DOT_PULL_PX;
    const spreadDots = [...spreadLabels(dots.map((d) => d.box).filter(near), seen), ...dots.map((d) => d.box).filter((b) => !near(b))];
    const dotOf = new Map(dots.map((d) => [d.box.id, d.route]));
    const named = map.getZoom() >= NAME_ZOOM && !layers.has("mounds") ? namesThatFit(spreadDots.map((b) => ({ id: b.id, x: b.x, y: b.y, name: dotOf.get(b.id)!.name })), seen) : null;
    for (const box of spreadDots) {
      const r = dotOf.get(box.id)!;
      const order = r.order;
      const name = r.name;
      const state = courseDotState(r);
      const at = map.unproject([box.x, box.y]);
      put(
        createCourseDot({
          number: String(order),
          name: named?.has(r.id) ? name : null,
          nameSide: named?.get(r.id),
          label: state === "done" ? t`${order}. ${name}（スタンプ完了）` : state === "soon" ? t`${order}. ${name}（準備中）` : t`${order}. ${name}`,
          state,
          onSelect: () => onSelectRoute(r.id),
        }),
        { lat: at.lat, lng: at.lng },
      );
    }

    // The labels of merged groups must not cover each other or sit under the buttons and the sheet: every name stays readable.
    if (merged.length > 0) {
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
      // Stops merge into numbered groups only when the visitor chose it. Otherwise each keeps its own pin, overlapping until
      // zoomed in; stops on one spot, which no zoom can part, share a pin with a small count that opens the list.
      const nearby = clusterByPixels(focus.stops.map((s) => pixel(s.id, s.position)), stopMergePx(mergeStops));
      const stopGroups = mergeStops ? nearby : samePlaceOnly(nearby, (id) => stopById.get(id)!.position);
      for (const ids of stopGroups) {
        const members = ids.map((id) => stopById.get(id)!);
        if (members.length === 1 || !mergeStops) {
          const s = members.find((m) => m.id === stopId) ?? members[0]!;
          const shared = members.length > 1;
          const el = createMarkerElement({
            order: s.order,
            label: shared ? t`ここに${members.length}か所あります。押すと一覧を開きます` : s.label,
            kind: s.noStamp ? "neutral" : markerKind(s.stamped, s.id === next),
            status: s.status,
            sideTrip: s.sideTrip,
            noStamp: s.noStamp,
            role: s.role,
            place: s.kind,
            photo: pinPhotoSrc(s.photo),
            stamped: s.stamped === true,
            onSelect: () => {
              if (shared) setPick(members);
              else onSelectStop(focus.id, s.id);
            },
          });
          if (shared) el.dataset.count = String(members.length);
          el.setAttribute("aria-pressed", String(s.id === stopId));
          put(el, s.position, "bottom");
        } else {
          const orders = members.flatMap((m) => (m.order === null ? [] : [m.order]));
          const text = orders.length > 1 ? `${Math.min(...orders)}–${Math.max(...orders)}` : String(members.length);
          put(
            createClusterElement({
              text,
              label: t`場所 ${text} がここに集まっています。押すと拡大します`,
              kind: "stops",
              // Pins on the same spot cannot be pulled apart by zooming: they are chosen from a list.
              onSelect: () => (spreadMeters(members.map((m) => m.position)) <= SAME_PLACE_M ? setPick(members) : zoomTo(members.map((m) => m.position))),
            }),
            centerOf(members.map((m) => m.position)),
          );
        }
      }
    }

    // The sutra mounds of every course, while no course is open (an open course shows its own stops).
    if (!focus && layers.has("mounds")) {
      const mounds = moundStops(routes);
      const byMound = new Map(mounds.map((m) => [m.stop.id, m]));
      const groups = mergeStops ? clusterByPixels(mounds.map((m) => pixel(m.stop.id, m.stop.position)), MERGE_PX.namedPin) : mounds.map((m) => [m.stop.id]);
      for (const ids of groups) {
        const members = ids.map((id) => byMound.get(id)!);
        if (members.length === 1) {
          const { route: owner, stop } = members[0]!;
          const name = stop.name;
          // A mound's name is long ("葛城第二十三経塚 倶戸羅・薬王菩薩本事品"): once tapped it shows beside the pin, cut short.
          const showName = revealed === stop.id;
          put(
            createPinElement({
              number: "経",
              name: showName ? (name.length > 16 ? `${name.slice(0, 15)}…` : name) : null,
              label: t`経塚 ${name}`,
              soon: false,
              onSelect: () => {
                if (!showName) return setRevealed(stop.id);
                setRevealed(null);
                onSelectMound(owner.id, stop.id);
              },
            }),
            stop.position,
            "bottom",
          );
        } else {
          const count = members.length;
          put(
            createClusterElement({
              text: String(count),
              label: t`経塚 ${count} か所がここに集まっています。押すと拡大します`,
              kind: "stops",
              onSelect: () => zoomTo(members.map((m) => m.stop.position)),
            }),
            centerOf(members.map((m) => m.stop.position)),
          );
        }
      }
    }

    // Toilets, shops and the like, once zoomed in: on the course that is open, or else on every course in view.
    if (map.getZoom() >= POINTS_ZOOM) {
      const seen = map.getBounds();
      for (const r of focus ? [focus] : routes) {
        for (const p of r.points) {
          const group = groupOf(p.category);
          if (!layers.has(group) || !seen.contains([p.position.lng, p.position.lat])) continue;
          put(
            createPlaceMarkerElement({
              group,
              category: p.category,
              icon: p.icon,
              label: p.name,
              closed: false,
              photo: !!p.photo,
              onSelect: () => {
                // The sheet shows the place, as it does a stop; the map moves only to keep the pin in view.
                setPick(null);
                selectPlaceRef.current(p);
                map.easeTo({ center: [p.position.lng, p.position.lat], padding: padding(), duration: 400 });
              },
            }),
            p.position,
          );
        }
      }
    }

    return () => live.forEach((m) => m.remove());
    // `t` changes only with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mapGen, view, routes, routeId, autoId, stopId, mergeStops, layers, revealed]);

  const zoom = (delta: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    const options = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? { duration: 0 } : undefined;
    if (delta > 0) map.zoomIn(options);
    else map.zoomOut(options);
  };

  if (failed) {
    return <p className="absolute inset-x-4 top-[calc(5rem+var(--top-clear))] z-10 rounded-2xl bg-surface p-4 text-lg">{t`この端末では地図を表示できません。下の一覧から区間を選べます。`}</p>;
  }

  return (
    <>
      <div className="absolute inset-0" lang={i18n.locale}>
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {ready ? null : <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-lg">{t`地図を読み込み中…`}</p>}

      <div
        role="group"
        aria-label={t`地図に出すもの`}
        style={{ marginLeft: coveredLeftPx }}
        // A mouse has no swipe and the bar is hidden: the wheel and a drag move the row too (touch scrolls it natively).
        onWheel={(e) => {
          if (e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY;
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          const row = e.currentTarget;
          const from = { x: e.clientX, left: row.scrollLeft, moved: false };
          const move = (m: PointerEvent) => {
            if (Math.abs(m.clientX - from.x) > 5) from.moved = true;
            if (from.moved) row.scrollLeft = from.left - (m.clientX - from.x);
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            // The click that ends a drag must not flip the chip it ended on.
            if (!from.moved) return;
            const stop = (c: Event) => c.stopPropagation();
            row.addEventListener("click", stop, { capture: true });
            setTimeout(() => row.removeEventListener("click", stop, { capture: true }), 0); // the click, if any, comes right after pointerup
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up, { once: true });
        }}
        // A row that scrolls sideways under the finger: no scrollbar, the page's edges fade where there is more, and a swipe on it
        // moves the row, not the map.
        className="map-layer-pills absolute inset-x-0 top-[calc(0.5rem+var(--top-clear))] z-[4] flex touch-pan-x snap-x scroll-pl-[6.75rem] scroll-pr-3 md:scroll-pl-3 gap-2 overflow-x-auto overscroll-x-contain pl-[6.75rem] pr-3 pb-1 md:pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]"
      >
        {offeredLayers(routes).map((layer) => {
          const on = layers.has(layer);
          const name = layer === "courses" ? t`コース` : layer === "mounds" ? t`経塚` : layer === "side" ? t`寄り道の線` : groupNames[layer];
          return (
            <button
              key={layer}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLayer(layer)}
              className={`tap-target flex shrink-0 snap-start items-center gap-2 rounded-full border border-ink px-4 text-lg font-bold shadow-md ${on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"}`}
            >
              {layer === "courses" || layer === "mounds" || layer === "side" ? null : <PlaceGroupPicture group={layer} size={22} />}
              {name}
            </button>
          );
        })}
      </div>

      {pick && focus ? (
        <MapPickList
          items={pick.map((s) => ({ id: s.id, order: s.order, name: s.name, nameLang: s.nameLang }))}
          bottomPx={coveredPx}
          onPick={(id) => {
            setPick(null);
            onSelectStop(focus.id, id);
          }}
          onClose={() => setPick(null)}
        />
      ) : null}

      {draftShown ? (
        <p style={{ marginLeft: coveredLeftPx, ...(controlsTopPx > 0 ? { top: controlsTopPx } : {}) }} className="absolute left-3 top-[calc(4.5rem+var(--top-clear))] z-[4] flex max-w-[calc(100%-6rem)] items-center gap-1.5 rounded-lg border-2 border-caution bg-paper px-2 py-1 text-base font-bold leading-tight">
          <span className="text-caution">
            <WarningIcon />
          </span>
          {t`見本の位置（目安です）`}
        </p>
      ) : null}

      <div style={controlsTopPx > 0 ? { top: controlsTopPx } : undefined} className="absolute right-[calc(0.75rem+env(safe-area-inset-right))] top-[calc(4.5rem+var(--top-clear))] z-[4] flex flex-col gap-2">
        {(["in", "out"] as const).map((sign) => (
          <button
            key={sign}
            type="button"
            onClick={() => zoom(sign === "in" ? 1 : -1)}
            aria-label={sign === "in" ? t`拡大` : t`縮小`}
            className="tap-target inline-flex items-center justify-center rounded-full border border-ink bg-paper text-2xl font-bold text-ink hover:bg-surface"
          >
            {sign === "in" ? <PlusIcon size={26} /> : <MinusIcon size={26} />}
          </button>
        ))}
        <MapHelp />
        <button
          type="button"
          onClick={toggleTilt}
          aria-pressed={flat}
          aria-label={flat ? t`地図を傾ける` : t`地図を平らにする（北が上）`}
          className="tap-target inline-flex items-center justify-center rounded-full border border-ink bg-paper text-ink hover:bg-surface"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 transition-transform" style={{ transform: `rotate(${-camera.bearing}deg) scaleY(${flat ? 1 : 0.8})` }}>
            <path d="M12 2 L17 12 H7 Z" className="fill-brand" />
            <path d="M12 22 L7 12 H17 Z" fill="currentColor" />
          </svg>
        </button>
        {user ? (
          <button
            type="button"
            onClick={startFollowing}
            aria-pressed={following}
            aria-label={t`現在地を真ん中にする（進む向きが上）`}
            className={`tap-target inline-flex items-center justify-center rounded-full border border-ink ${following ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-surface"}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </>
  );
}

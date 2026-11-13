"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { mapStyle, zoomLimits } from "@/lib/map";
import { boundsFromBox, boundsOfPoints, boxFromBounds, dragCorner, moveBox, padBounds, type Bounds } from "@/lib/route-geometry";
import { NumberInput, Section } from "./fields";

// 管理 > ルート > 地図: the box drawn for the course on the visitors' overview map. Left alone, it is the box around the checked
// line; here an editor can set it by hand (also for a course that is not open yet, so it shows on the map as 準備中). The map
// shows the course's line and stops, the box with a handle on each corner (resize) and one in the middle (move). The numbers
// below it are the same box in the other form (centre and size in metres).
const KONGO: [number, number] = [135.45, 34.45];
type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
const BOX_COLOR = "#cc6256";

const ring = (b: Bounds): [number, number][] => [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]];
const polygon = (b: Bounds | null) => ({ type: "FeatureCollection" as const, features: b ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring(b)] } }] : [] });
const cornerAt = (b: Bounds, c: Corner): [number, number] => [c.endsWith("w") ? b.west : b.east, c.startsWith("n") ? b.north : b.south];
const centreOf = (b: Bounds): [number, number] => [(b.west + b.east) / 2, (b.south + b.north) / 2];

export function CourseAreaEditor({ area, line, places, onChange }: { area: Bounds | null; line: readonly (readonly (number | undefined)[])[]; places: { lat: number; lng: number }[]; onChange: (area: Bounds | null) => void }) {
  const { t } = useLingui();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const handles = useRef<{ corners: Record<Corner, Marker>; centre: Marker } | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const latest = useRef({ area, onChange });
  useEffect(() => {
    latest.current = { area, onChange };
  });

  // What the box would be with nothing set: the box around the course's line and stops (shown dashed for reference).
  const automatic = useMemo(() => boundsOfPoints([...line.map((p) => [p[0]!, p[1]!]), ...places.map((p) => [p.lng, p.lat])]), [line, places]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const start = latest.current.area ?? null;
        map = new ml.Map({ container: container.current, style: mapStyle(), center: start ? centreOf(start) : KONGO, zoom: start ? 11 : 9, minZoom: zoomLimits.min, maxZoom: zoomLimits.max, dragRotate: false, pitchWithRotate: false });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {});
        const m = map;
        m.on("load", () => {
          if (cancelled) return;
          m.addSource("auto", { type: "geojson", data: polygon(null) });
          m.addSource("area", { type: "geojson", data: polygon(null) });
          m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: "auto-line", type: "line", source: "auto", paint: { "line-color": "#4b4b4b", "line-width": 2, "line-dasharray": [3, 2] } });
          m.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": BOX_COLOR, "fill-opacity": 0.12 } });
          m.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#8e2a21", "line-width": 3 } });
          m.addLayer({ id: "route-line", type: "line", source: "route", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#6d28d9", "line-width": 3 } });
          m.addLayer({ id: "route-stops", type: "circle", source: "route", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": "#6d28d9", "circle-stroke-width": 2 } });
          const report = (b: Bounds) => latest.current.onChange(b);
          // While a handle is dragged the outline and every other handle follow it, so none is left behind.
          const follow = (b: Bounds, dragged: Corner | "centre") => {
            (m.getSource("area") as GeoJSONSource).setData(polygon(b));
            const h = handles.current;
            if (!h) return;
            for (const k of CORNERS) if (k !== dragged) h.corners[k].setLngLat(cornerAt(b, k));
            if (dragged !== "centre") h.centre.setLngLat(centreOf(b));
          };
          const dot = (cls: string) => {
            const el = document.createElement("div");
            el.className = cls;
            return el;
          };
          const corner = {} as Record<Corner, Marker>;
          for (const c of CORNERS) {
            const marker = new ml.Marker({ element: dot("size-4 cursor-grab rounded-[3px] border-2 border-white bg-ink shadow-md active:cursor-grabbing"), draggable: true });
            marker.on("drag", () => {
              const cur = latest.current.area;
              if (cur) follow(dragCorner(cur, c, marker.getLngLat()), c);
            });
            marker.on("dragend", () => {
              const cur = latest.current.area;
              if (!cur) return;
              const b = dragCorner(cur, c, marker.getLngLat());
              report(b);
              marker.setLngLat(cornerAt(b, c)); // a corner that could not go that far returns to the box's real corner
            });
            corner[c] = marker;
          }
          const centre = new ml.Marker({ element: dot("size-7 cursor-move rounded-full border-2 border-white bg-brand shadow-md"), draggable: true });
          centre.on("drag", () => {
            const cur = latest.current.area;
            if (cur) follow(moveBox(cur, centre.getLngLat()), "centre");
          });
          centre.on("dragend", () => {
            const cur = latest.current.area;
            if (cur) report(moveBox(cur, centre.getLngLat()));
          });
          handles.current = { corners: corner, centre };
          mapRef.current = m;
          setReady(true);
        });
      } catch {
        if (!cancelled) setFailed(true); // no WebGL: the numbers below still work
      }
    })();
    return () => {
      cancelled = true;
      map?.remove(); // CLAUDE.md: the map is always removed on unmount
      mapRef.current = null;
      handles.current = null;
    };
  }, []);

  // The line, the stops, the automatic box and the chosen box follow the draft.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        ...(line.length >= 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line.map((p) => [p[0]!, p[1]!]) } }] : []),
        ...places.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } })),
      ],
    });
    (map.getSource("auto") as GeoJSONSource).setData(polygon(area ? null : automatic));
    (map.getSource("area") as GeoJSONSource).setData(polygon(area));
    const h = handles.current;
    if (!h) return;
    if (area) {
      for (const c of CORNERS) h.corners[c].setLngLat(cornerAt(area, c)).addTo(map);
      h.centre.setLngLat(centreOf(area)).addTo(map);
    } else {
      for (const c of CORNERS) h.corners[c].remove();
      h.centre.remove();
    }
  }, [ready, line, places, area, automatic]);

  // Show the whole box (or the course) once the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    const target = area ?? automatic;
    if (!map || !ready || !target) return;
    map.fitBounds([[target.west, target.south], [target.east, target.north]], { padding: 60, maxZoom: 14, duration: 0 });
    // Only when the map is ready: adjusting the box must not move the view under the editor's hands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const box = area ? boxFromBounds(area) : null;
  const set = (patch: Partial<NonNullable<typeof box>>) => {
    if (!box) return;
    const next = { ...box, ...patch };
    onChange(boundsFromBox(next));
  };
  // One corner typed in: the opposite corner stays, like dragging it.
  const setCorner = (c: Corner, patch: { lat?: number; lng?: number }) => {
    if (!area) return;
    const [lng, lat] = cornerAt(area, c);
    onChange(dragCorner(area, c, { lat, lng, ...patch }));
  };
  const cornerLabel: Record<Corner, string> = { nw: t`北西の角`, ne: t`北東の角`, sw: t`南西の角`, se: t`南東の角` };
  // A new box (from the course, or a small one in the middle of the view) is brought into view: at the wide first zoom a 4 km
  // box is a few pixels, and its four handles would sit on top of each other.
  const start = () => {
    const map = mapRef.current;
    const c = map ? map.getCenter() : { lat: KONGO[1], lng: KONGO[0] };
    const next = padBounds(automatic) ?? boundsFromBox({ lat: c.lat, lng: c.lng, widthM: 4000, heightM: 3000 });
    onChange(next);
    map?.fitBounds([[next.west, next.south], [next.east, next.north]], { padding: 80, maxZoom: 14, duration: 400 });
  };

  const button = "tap-target inline-flex items-center justify-center rounded-full border border-ink bg-paper px-5 text-base font-bold hover:bg-surface";
  return (
    <Section title={t`コースの範囲`} id="area-section">
      <p className="text-base text-muted">{t`訪れる人の、全体の地図に出る四角です。ふだんは、確かめた線のまわりに自動で決まります。ここで手で決めると、まだ公開していないルートも、「準備中」として地図に出ます。`}</p>
      {failed ? (
        <p className="text-base text-muted">{t`地図を表示できませんでした。`}</p>
      ) : (
        <div ref={container} role="application" aria-label={t`コースの範囲の地図`} className="h-96 w-full overflow-hidden rounded-xl border border-line" />
      )}
      <p className="text-base font-bold" aria-live="polite">
        {area ? t`いまは、手で決めた四角です。` : t`いまは、自動の四角です（点線）。`}
      </p>
      {area ? <p className="text-base text-muted">{t`四すみの四角をドラッグすると大きさが、まん中の丸をドラッグすると位置が変わります。`}</p> : null}
      <div className="flex flex-wrap gap-3">
        {!area ? (
          <button type="button" onClick={start} className={button}>
            {t`手で決める`}
          </button>
        ) : (
          <>
            <button type="button" onClick={start} className={button}>
              {t`線と経由地から作りなおす`}
            </button>
            <button type="button" onClick={() => onChange(null)} className={button}>
              {t`自動にもどす`}
            </button>
          </>
        )}
      </div>
      {box ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-base font-bold" htmlFor="area-lat">
            {t`中心の緯度`}
            <NumberInput id="area-lat" value={Math.round(box.lat * 1e6) / 1e6} min={20} max={46} step={0.0001} wide onChange={(v) => v !== null && set({ lat: v })} />
          </label>
          <label className="flex flex-col gap-1 text-base font-bold" htmlFor="area-lng">
            {t`中心の経度`}
            <NumberInput id="area-lng" value={Math.round(box.lng * 1e6) / 1e6} min={122} max={154} step={0.0001} wide onChange={(v) => v !== null && set({ lng: v })} />
          </label>
          <label className="flex flex-col gap-1 text-base font-bold" htmlFor="area-width">
            {t`横の長さ`}
            <NumberInput id="area-width" value={Math.round(box.widthM)} min={500} max={200000} integer suffix="m" onChange={(v) => v !== null && set({ widthM: v })} />
          </label>
          <label className="flex flex-col gap-1 text-base font-bold" htmlFor="area-height">
            {t`縦の長さ`}
            <NumberInput id="area-height" value={Math.round(box.heightM)} min={500} max={200000} integer suffix="m" onChange={(v) => v !== null && set({ heightM: v })} />
          </label>
        </div>
      ) : null}
      {area ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {CORNERS.map((c) => {
            const [lng, lat] = cornerAt(area, c);
            return (
              <fieldset key={c} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <legend className="px-1 text-base font-bold">{cornerLabel[c]}</legend>
                <label className="flex flex-col gap-1 text-base font-bold" htmlFor={`area-${c}-lat`}>
                  {t`緯度`}
                  <NumberInput id={`area-${c}-lat`} value={lat} min={20} max={46} step={0.0001} wide onChange={(v) => v !== null && setCorner(c, { lat: v })} />
                </label>
                <label className="flex flex-col gap-1 text-base font-bold" htmlFor={`area-${c}-lng`}>
                  {t`経度`}
                  <NumberInput id={`area-${c}-lng`} value={lng} min={122} max={154} step={0.0001} wide onChange={(v) => v !== null && setCorner(c, { lng: v })} />
                </label>
              </fieldset>
            );
          })}
        </div>
      ) : null}
    </Section>
  );
}

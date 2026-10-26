"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { mapStyle, zoomLimits } from "@/lib/map";

// Shows where a latitude/longitude is, so a position can be checked by eye: the pin can be dragged, or the map clicked,
// to move it. The numbers stay the source of truth; this only reads them and reports a new pair.
const KONGO: [number, number] = [135.68, 34.42];
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function PositionMap({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void }) {
  const { t } = useLingui();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const first = useRef({ lat, lng });
  const report = useRef(onChange);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    report.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const at = first.current.lat !== null && first.current.lng !== null ? ([first.current.lng, first.current.lat] as [number, number]) : null;
        map = new ml.Map({ container: container.current, style: mapStyle(), center: at ?? KONGO, zoom: at ? 16 : 11, minZoom: zoomLimits.min, maxZoom: zoomLimits.max, dragRotate: false, pitchWithRotate: false });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {});
        const marker = new ml.Marker({ draggable: true });
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          report.current(round(p.lat), round(p.lng));
        });
        if (at) marker.setLngLat(at).addTo(map);
        map.on("click", (e) => {
          marker.setLngLat(e.lngLat).addTo(map!);
          report.current(round(e.lngLat.lat), round(e.lngLat.lng));
        });
        mapRef.current = map;
        pin.current = marker;
      } catch {
        if (!cancelled) setFailed(true); // no WebGL: the numbers and the link below still work
      }
    })();
    return () => {
      cancelled = true;
      map?.remove(); // CLAUDE.md: the map is always removed on unmount
      mapRef.current = pin.current = null;
    };
  }, []);

  // The numbers were typed (or the pin moved): follow them.
  useEffect(() => {
    const map = mapRef.current;
    const marker = pin.current;
    if (!map || !marker || lat === null || lng === null) return;
    const now = marker.getElement().isConnected ? marker.getLngLat() : null;
    if (now && Math.abs(now.lat - lat) < 1e-7 && Math.abs(now.lng - lng) < 1e-7) return;
    marker.setLngLat([lng, lat]).addTo(map);
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
  }, [lat, lng]);

  return (
    <div className="flex flex-col gap-2">
      {failed ? (
        <p className="text-base text-muted">{t`地図を表示できませんでした。`}</p>
      ) : (
        <div ref={container} role="application" aria-label={t`位置の地図`} className="h-72 w-full overflow-hidden rounded-xl border border-line" />
      )}
      <p className="text-base text-muted">{t`地図をクリックするか、ピンを動かすと、緯度・経度が入ります。`}</p>
      {lat !== null && lng !== null ? (
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="w-fit text-base font-bold text-accent underline underline-offset-4">
          {t`Google マップで開く`}
        </a>
      ) : null}
    </div>
  );
}

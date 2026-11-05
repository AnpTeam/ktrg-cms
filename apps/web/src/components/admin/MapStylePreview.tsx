"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { largeStyleUrl, mapStyleSource } from "@/lib/large-map-style";
import { terrainLayerId, zoomLimits } from "@/lib/map";
import type { MapSettings } from "@/lib/map-settings";

// A map the admin can move around, drawn with the style being chosen. The terrain shading is off, as it is for a visitor
// until they press "terrain"; a switch turns it on so its strength can be judged too. Nothing is saved here.

// The vector style is an address; it carries the terrain switch itself.
const withTerrain = (settings: MapSettings, on: boolean): StyleSpecification | string => {
  const style = mapStyleSource(settings);
  if (typeof style === "string") return largeStyleUrl(settings, on);
  return { ...style, layers: style.layers.map((l) => (l.id === terrainLayerId ? { ...l, layout: { ...l.layout, visibility: on ? ("visible" as const) : ("none" as const) } } : l)) };
};

export function MapStylePreview({ settings }: { settings: MapSettings }) {
  const { t } = useLingui();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const first = useRef(settings);
  const [failed, setFailed] = useState(false);
  const [terrain, setTerrain] = useState(false);
  const terrainRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        map = new ml.Map({
          container: container.current,
          style: withTerrain(first.current, terrainRef.current),
          center: [135.68, 34.42], // around Mt Kongō, where the mountains and the villages both show
          zoom: 11,
          minZoom: zoomLimits.min,
          maxZoom: zoomLimits.max,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: false },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {});
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true); // no WebGL: the choices still work, only the preview is missing
      }
    })();
    return () => {
      cancelled = true;
      map?.remove(); // CLAUDE.md: the map is always removed on unmount
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    terrainRef.current = terrain;
    // Waits for the slider to rest: the vector style is large and each change loads it again.
    const timer = setTimeout(() => mapRef.current?.setStyle(withTerrain(settings, terrain)), 250);
    return () => clearTimeout(timer);
  }, [settings, terrain]);

  return failed ? (
    <p className="rounded-xl bg-surface p-4 text-lg">{t`この端末では地図の見本を表示できません。`}</p>
  ) : (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-3 text-lg">
        <input type="checkbox" checked={terrain} onChange={(e) => setTerrain(e.target.checked)} className="size-6" />
        {t`「地形」ボタンを押した状態で見る`}
      </label>
      <div ref={container} role="region" aria-label={t`地図の見本`} className="h-[26rem] w-full overflow-hidden rounded-2xl bg-surface" />
    </div>
  );
}

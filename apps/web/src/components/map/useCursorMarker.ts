"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useElevationCursor } from "@/lib/elevation-cursor";

/**
 * Shows a dot on the map where the visitor's pointer is on an elevation chart on the same screen (the chart writes the
 * place, see lib/elevation-cursor.ts). `gen` changes when the map is rebuilt.
 */
export function useCursorMarker(mapRef: RefObject<MapLibreMap | null>, mlRef: RefObject<typeof import("maplibre-gl") | null>, gen: number, ready = true) {
  const cursor = useElevationCursor();
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    if (!cursor) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.className = "pointer-events-none size-4 rounded-full border-[3px] border-paper bg-ink shadow-md";
      marker.current = new ml.Marker({ element: el }).setLngLat([cursor.lng, cursor.lat]).addTo(map);
    } else marker.current.setLngLat([cursor.lng, cursor.lat]);
  }, [cursor, gen, ready, mapRef, mlRef]);

  // A rebuilt or removed map takes its markers with it.
  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [gen],
  );
}

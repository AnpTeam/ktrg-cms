import { useSyncExternalStore } from "react";
import type { LatLng } from "./navigation/geometry";

// Where the visitor's pointer is on an elevation chart, as a place on the course, so a map on the same screen can show a
// dot there. A tiny shared store (no library): the chart writes it, the maps read it. Lives in memory only.

let current: LatLng | null = null;
const listeners = new Set<() => void>();

export function setElevationCursor(point: LatLng | null): void {
  if (point === current || (point && current && point.lat === current.lat && point.lng === current.lng)) return;
  current = point;
  listeners.forEach((l) => l());
}

export const getElevationCursor = (): LatLng | null => current;

export function useElevationCursor(): LatLng | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

import type { PaddingOptions } from "maplibre-gl";
import type { SheetSnap } from "@/lib/map-screen";

export interface MapCamera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  padding: PaddingOptions;
}

export interface MapPlace {
  routeId: string | null;
  stopId: string | null;
  viaMounds: boolean;
  snap: SheetSnap;
}

/**
 * Where the visitor left /map, so going to a course's page and back returns to the same view. Written only in the browser.
 * shortcut: held in memory, so a full reload or iOS closing the app starts over; move it to sessionStorage if that matters.
 */
export const mapMemory: { place: MapPlace | null; camera: MapCamera | null } = { place: null, camera: null };

interface Arrival {
  routeIds: readonly string[];
  /** What the address asks for (a link such as "show on map"): that wins over the memory, unless it is the same course. */
  wantedRouteId: string | null;
  wantedStopId: string | null;
  wantedPlaceId: string | null;
  navigating: boolean;
}

/** What to bring back on arriving at /map, or null to start as usual. */
export function resumeFrom(memory: typeof mapMemory, arrival: Arrival): (MapPlace & { camera: MapCamera | null }) | null {
  const { place, camera } = memory;
  if (!place || arrival.navigating || arrival.wantedPlaceId || arrival.wantedStopId) return null;
  if (arrival.wantedRouteId && arrival.wantedRouteId !== place.routeId) return null;
  if (place.routeId && !arrival.routeIds.includes(place.routeId)) return null; // the course is gone (unpublished)
  return { ...place, snap: place.snap === "hidden" ? (place.routeId ? "half" : "peek") : place.snap, camera };
}

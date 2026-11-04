"use client";

import { useEffect, useState } from "react";
import { getRouteLine } from "@/lib/navigation/line-client";

export interface RouteLineWithElevation {
  line: { lat: number; lng: number }[];
  elevations: (number | null)[];
}

/**
 * A course's own line with an elevation for each point, loaded as soon as `routeId` is given (null: none wanted), so a
 * graph on screen can be drawn from it. Shared with the map, so it is one request. Null until it arrives, or when the
 * course has no line or its line has no elevations.
 */
export function useRouteLine(routeId: string | null): RouteLineWithElevation | null {
  const [loaded, setLoaded] = useState<{ id: string; value: RouteLineWithElevation | null } | null>(null);
  useEffect(() => {
    if (!routeId) return;
    let stale = false;
    void getRouteLine(routeId).then((pts) => {
      if (stale) return;
      const has = pts?.some((p) => typeof p[2] === "number") ?? false;
      setLoaded({ id: routeId, value: pts && has ? { line: pts.map((p) => ({ lat: p[1], lng: p[0] })), elevations: pts.map((p) => (typeof p[2] === "number" ? p[2] : null)) } : null });
    });
    return () => {
      stale = true;
    };
  }, [routeId]);
  return loaded && loaded.id === routeId ? loaded.value : null;
}

// Snapping a hand-drawn route to real trails (admin only). The service asks OpenRouteService for a walking route
// (profile "foot-hiking", OpenStreetMap data) through the given points and returns the line it found.
//
// The key stays on the server: the browser calls our own API, never OpenRouteService. Nothing here logs the key, the
// points or the answer. Without a key the service says so and the editor keeps working by hand.

import type { ErrorCode } from "../lib/api-errors";
import { AUTH_LIMITS, type RateLimiter } from "../auth/rate-limit";

export interface LatLng {
  lat: number;
  lng: number;
}

/** [longitude, latitude, height in metres?], like the route line the editor saves. */
export type LinePoint = [number, number, number?];

export type SnapResult =
  | { ok: true; line: LinePoint[]; distanceM: number }
  | { ok: false; reason: Extract<ErrorCode, "routing_unavailable" | "routing_no_route" | "routing_failed"> };

export interface RoutingService {
  /** A walking line through the points, in order (2 to 50 points). */
  snap(points: readonly LatLng[]): Promise<SnapResult>;
}

const ENDPOINT = "https://api.openrouteservice.org/v2/directions/foot-hiking/geojson";
/** A rough point is moved to the nearest path within this many metres. */
const SEARCH_RADIUS_M = 1000;
/** The longest line taken from the service (the route line allows 50,000 points). */
const MAX_LINE_POINTS = 50_000;

/**
 * The service with a cap on calls per day for the whole site. Only a call that would really go to OpenRouteService counts
 * (the per-user limits run first, so a refused request never reaches this), and over the cap it answers like a service
 * that is not available, which the screens already handle.
 */
export function withDailyCap(inner: RoutingService, limiter: Pick<RateLimiter, "check">): RoutingService {
  return {
    async snap(points) {
      const r = await limiter.check(AUTH_LIMITS.routingDaily, "all");
      return r.allowed ? inner.snap(points) : { ok: false, reason: "routing_unavailable" };
    },
  };
}

export function createRoutingService({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 20_000,
}: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): RoutingService {
  return {
    async snap(points) {
      if (!apiKey) return { ok: false, reason: "routing_unavailable" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/geo+json" },
          body: JSON.stringify({
            coordinates: points.map((p) => [p.lng, p.lat]),
            radiuses: points.map(() => SEARCH_RADIUS_M),
            elevation: true,
            instructions: false,
          }),
          signal: controller.signal,
        });
        // A key that is wrong, expired or out of quota looks the same to the admin: the service cannot be used now.
        if (res.status === 401 || res.status === 403 || res.status === 429) return { ok: false, reason: "routing_unavailable" };
        // 404: no path near one of the points (or between them).
        if (res.status === 404) return { ok: false, reason: "routing_no_route" };
        if (!res.ok) return { ok: false, reason: "routing_failed" };
        return parseSnapAnswer(await res.json());
      } catch {
        return { ok: false, reason: "routing_failed" }; // no network, a timeout, or an answer that is not JSON
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Reads OpenRouteService's GeoJSON answer. Anything that is not a line of at least two valid points is a failure. */
export function parseSnapAnswer(answer: unknown): SnapResult {
  const feature = (answer as { features?: { geometry?: { coordinates?: unknown }; properties?: { summary?: { distance?: unknown } } }[] } | null)?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > MAX_LINE_POINTS) return { ok: false, reason: "routing_failed" };
  const line: LinePoint[] = [];
  for (const c of coordinates) {
    if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number" || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) {
      return { ok: false, reason: "routing_failed" };
    }
    // About 10 cm is plenty, and the map editor refuses positions with more decimals than that.
    const lng = Math.round(c[0] * 1e6) / 1e6;
    const lat = Math.round(c[1] * 1e6) / 1e6;
    line.push(typeof c[2] === "number" && Number.isFinite(c[2]) ? [lng, lat, Math.round(c[2] * 10) / 10] : [lng, lat]);
  }
  const distance = feature?.properties?.summary?.distance;
  return { ok: true, line, distanceM: typeof distance === "number" && Number.isFinite(distance) ? Math.round(distance) : 0 };
}

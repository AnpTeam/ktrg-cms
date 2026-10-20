// Walking paths from OpenRouteService for a visitor who is off the course line, through our API
// (POST /api/v1/navigation/path, signed-in only). When to ask is a pure rule (shouldAskForPath) so it is tested; asking
// never throws. The visitor's position is sent for this one request and is not kept by the server.

import { distanceM, type LatLng, type LinePoint } from "./geometry";

/** Never ask more often than this, whatever happens. */
export const PATH_MIN_INTERVAL_MS = 30_000;
/** Ask again for the same stop once the visitor has moved this far from where the last path started. */
export const PATH_REASK_MOVED_M = 50;
/** After "the service is not available" or "too many requests", wait this long before asking again. */
export const PATH_BACKOFF_MS = 5 * 60_000;

export type PathAnswer =
  | { ok: true; line: LinePoint[] }
  /** `backOff`: the service is down or the allowance is used up; asking again soon would not help. */
  | { ok: false; backOff: boolean };

export function parsePathResponse(status: number, body: unknown): PathAnswer {
  const b = (typeof body === "object" && body !== null ? body : {}) as { ok?: unknown; line?: unknown };
  if (status === 200 && b.ok === true && Array.isArray(b.line)) {
    const line: LinePoint[] = [];
    for (const p of b.line) {
      if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number" || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        return { ok: false, backOff: false };
      }
      line.push([p[0], p[1]]);
    }
    if (line.length >= 2) return { ok: true, line };
    return { ok: false, backOff: false };
  }
  return { ok: false, backOff: status === 503 || status === 429 };
}

/** Ask our API for a walking path to the stop. Never throws: a network failure is a plain "no path". */
export async function requestPath(spotId: string, from: LatLng): Promise<PathAnswer> {
  try {
    const res = await fetch("/api/v1/navigation/path", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spotId, lat: from.lat, lng: from.lng }),
    });
    return parsePathResponse(res.status, await res.json().catch(() => null));
  } catch {
    return { ok: false, backOff: false };
  }
}

/** What is remembered about the last ask (in memory only, for the session). */
export interface LastAsk {
  stopId: string;
  atMs: number;
  from: LatLng;
  /** Set when the answer said to back off. */
  backOffUntilMs?: number;
}

/**
 * Whether to ask for a path now. `wanted`: the visitor is off the course line and off any path for `stopId`
 * (session.wantsPath). The first time at once; then for a new stop, or for the same stop after moving
 * PATH_REASK_MOVED_M, but never more often than PATH_MIN_INTERVAL_MS, and not at all while backing off.
 */
export function shouldAskForPath(wanted: boolean, stopId: string | null, fix: LatLng, nowMs: number, last: LastAsk | null): boolean {
  if (!wanted || stopId === null) return false;
  if (!last) return true;
  if (last.backOffUntilMs !== undefined && nowMs < last.backOffUntilMs) return false;
  if (nowMs - last.atMs < PATH_MIN_INTERVAL_MS) return false;
  return last.stopId !== stopId || distanceM(fix, last.from) >= PATH_REASK_MOVED_M || last.backOffUntilMs !== undefined;
}

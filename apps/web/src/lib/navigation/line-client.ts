import type { Position } from "../map";

/**
 * A course's path from the API. The map page does not send it (it is the heaviest part), so a navigation fetches it when it
 * starts; without it the guidance would only know the stops. Never throws: null means "no path", and navigation then
 * guides straight to the stops.
 */
export async function fetchRouteLine(routeId: string): Promise<Position[] | null> {
  try {
    const res = await fetch(`/api/v1/routes/${encodeURIComponent(routeId)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { route?: { line?: { coordinates?: unknown } | null } };
    const coords = body.route?.line?.coordinates;
    if (!Array.isArray(coords)) return null;
    const line: Position[] = [];
    for (const c of coords) {
      if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
      line.push({ lat: c[1], lng: c[0] });
    }
    return line.length >= 2 ? line : null;
  } catch {
    return null;
  }
}

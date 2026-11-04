import type { LinePoint } from "./geometry";

/**
 * A course's path from the API. The map page does not send it (it is the heaviest part), so a navigation fetches it when it
 * starts; without it the guidance would only know the stops. Never throws: null means "no path", and navigation then
 * guides straight to the stops.
 */
export async function fetchRouteLine(routeId: string): Promise<LinePoint[] | null> {
  try {
    const res = await fetch(`/api/v1/routes/${encodeURIComponent(routeId)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { route?: { line?: { coordinates?: unknown } | null } };
    const coords = body.route?.line?.coordinates;
    if (!Array.isArray(coords)) return null;
    const line: LinePoint[] = [];
    for (const c of coords) {
      if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
      line.push(typeof c[2] === "number" ? [c[0], c[1], c[2]] : [c[0], c[1]]); // keeps the elevation, for the strip
    }
    return line.length >= 2 ? line : null;
  } catch {
    return null;
  }
}

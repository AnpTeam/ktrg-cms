import type { LngLatEle } from "./line";

// Reads the points of a GPX file (the Navivi export `raw_track.gpx`, or any track from a GPS watch or phone).
// Plain text parsing, so it runs the same in the browser and in tests. A file that declares entities or a
// DOCTYPE is refused (nothing here would expand them, but there is no reason to accept them).

const MAX_POINTS = 200_000;

const attr = (tag: string, name: string): number | null => {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, "i").exec(tag) ?? new RegExp(`\\b${name}\\s*=\\s*'([^']+)'`, "i").exec(tag);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
};

/** A named point of a GPX file (`<wpt>`): a GPS watch's marked spot, or a stop exported from a planning tool. */
export interface GpxWaypoint {
  lat: number;
  lng: number;
  name: string;
}

const decode = (s: string) =>
  s
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/** The named points (`<wpt>`) of a file; one with a position out of range is skipped. */
function waypointsOf(xml: string): GpxWaypoint[] {
  const out: GpxWaypoint[] = [];
  for (const m of xml.matchAll(/<wpt\b([^>]*?)(\/>|>([\s\S]*?)<\/wpt>)/gi)) {
    const lat = attr(m[1]!, "lat");
    const lng = attr(m[1]!, "lon");
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const name = m[3] ? /<name>([\s\S]*?)<\/name>/i.exec(m[3])?.[1] : undefined;
    out.push({ lat, lng, name: name ? decode(name).slice(0, 200) : "" });
    if (out.length >= 500) break;
  }
  return out;
}

/** A file is usable when it has a path of at least two points or at least one named point (or both). */
export function parseGpx(xml: string): { ok: true; points: LngLatEle[]; waypoints: GpxWaypoint[] } | { ok: false } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { ok: false };
  const points: LngLatEle[] = [];
  // Track points first; a file with only a planned route uses route points instead.
  for (const tagName of ["trkpt", "rtept"]) {
    const re = new RegExp(`<${tagName}\\b([^>]*?)(/>|>([\\s\\S]*?)</${tagName}>)`, "gi");
    for (const m of xml.matchAll(re)) {
      const lat = attr(m[1]!, "lat");
      const lng = attr(m[1]!, "lon");
      if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false };
      const ele = m[3] ? /<ele>\s*([-+0-9.eE]+)\s*<\/ele>/i.exec(m[3])?.[1] : undefined;
      const e = ele === undefined ? NaN : Number(ele);
      points.push(Number.isFinite(e) ? [lng, lat, e] : [lng, lat]);
      if (points.length > MAX_POINTS) return { ok: false };
    }
    if (points.length > 0) break;
  }
  const waypoints = waypointsOf(xml);
  const path = points.length >= 2 ? points : [];
  return path.length > 0 || waypoints.length > 0 ? { ok: true, points: path, waypoints } : { ok: false };
}

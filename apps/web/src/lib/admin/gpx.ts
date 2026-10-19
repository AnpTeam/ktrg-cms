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

export function parseGpx(xml: string): { ok: true; points: LngLatEle[] } | { ok: false } {
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
  return points.length >= 2 ? { ok: true, points } : { ok: false };
}

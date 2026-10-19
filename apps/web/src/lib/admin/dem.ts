import type { LngLatEle } from "./line";

// Elevation from the Geospatial Information Authority's elevation tiles (標高タイル, PNG form), read in the browser:
// one tile covers a wide area, so a whole route needs a few tile downloads, not one request per point. Used only
// for points that have no elevation of their own (a hand-drawn line); a GPX file brings its own.
// https://maps.gsi.go.jp/development/demtile.html : height = (R*65536 + G*256 + B) / 100, with 2^23 meaning no data.

export const DEM_ZOOM = 14;
export const DEM_TILE_URL = (z: number, x: number, y: number) => `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${z}/${x}/${y}.png`;

/** The height in metres for one pixel, or null where the tile has no data. */
export function decodeDem(r: number, g: number, b: number): number | null {
  const x = r * 65536 + g * 256 + b;
  if (x === 8_388_608) return null;
  return (x < 8_388_608 ? x : x - 16_777_216) * 0.01;
}

/** Which tile a position falls in at zoom `z`, and which pixel (0..255) inside it. */
export function tileFor(lng: number, lat: number, z: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return { x, y, px: Math.min(255, Math.floor((fx - x) * 256)), py: Math.min(255, Math.floor((fy - y) * 256)) };
}

/** The height at a pixel of an RGBA tile image. */
export function demAt(rgba: Uint8ClampedArray | Uint8Array, px: number, py: number): number | null {
  const i = (py * 256 + px) * 4;
  if (i < 0 || i + 2 >= rgba.length) return null;
  return decodeDem(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
}

/**
 * Give every point that has no elevation one from the tiles. `loadTile` returns a tile's RGBA pixels (256 x 256), or
 * null when it cannot be loaded; points whose tile is missing stay without elevation, and the caller carries on.
 * Each tile is requested once.
 */
export async function fillElevations(
  points: readonly LngLatEle[],
  loadTile: (z: number, x: number, y: number) => Promise<Uint8ClampedArray | null>,
): Promise<{ points: LngLatEle[]; missing: number }> {
  const tiles = new Map<string, Promise<Uint8ClampedArray | null>>();
  const get = (z: number, x: number, y: number) => {
    const key = `${z}/${x}/${y}`;
    if (!tiles.has(key)) tiles.set(key, loadTile(z, x, y).catch(() => null));
    return tiles.get(key)!;
  };
  let missing = 0;
  const out: LngLatEle[] = [];
  for (const p of points) {
    if (typeof p[2] === "number") {
      out.push(p);
      continue;
    }
    const t = tileFor(p[0], p[1], DEM_ZOOM);
    const rgba = await get(DEM_ZOOM, t.x, t.y);
    const h = rgba ? demAt(rgba, t.px, t.py) : null;
    if (h === null) {
      missing++;
      out.push([p[0], p[1]]);
    } else out.push([p[0], p[1], Math.round(h * 10) / 10]);
  }
  return { points: out, missing };
}

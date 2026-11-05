import type { RouteArea } from "./map-screen";

// Which map tiles to keep for a route so its map still draws without a signal (see lib/offline-pack.ts).

const M_PER_DEG_LAT = 111_320;

const tileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Tile addresses covering the course's area (with a margin) from `minZoom` up to `maxZoom`, stopping at `limit` tiles. */
export function tileUrls(area: RouteArea, template: string, minZoom = 11, maxZoom = 15, limit = 300): string[] {
  const dLat = (area.heightM / 2 / M_PER_DEG_LAT) * 1.3;
  const dLng = (area.widthM / 2 / (M_PER_DEG_LAT * Math.cos((area.lat * Math.PI) / 180))) * 1.3;
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const [x0, x1] = [tileX(area.lng - dLng, z), tileX(area.lng + dLng, z)];
    const [y0, y1] = [tileY(area.lat + dLat, z), tileY(area.lat - dLat, z)];
    if ((x1 - x0 + 1) * (y1 - y0 + 1) + urls.length > limit) break; // the next zoom would be too many: keep the ones before it
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
  }
  return urls;
}

import type { LngLatEle } from "./line";

// The points sent to the route-finding service when a leg is snapped to walking trails (the editor thins a leg to a few). Pure.

export interface SnapPoint {
  lat: number;
  lng: number;
}

/** The same line with positions rounded to 6 decimals (about 10 cm) and heights to one: the line editor refuses more. */
export function roundLine(line: readonly LngLatEle[]): LngLatEle[] {
  return line.map((p) => {
    const lng = Math.round(p[0] * 1e6) / 1e6;
    const lat = Math.round(p[1] * 1e6) / 1e6;
    return typeof p[2] === "number" ? [lng, lat, Math.round(p[2] * 10) / 10] : [lng, lat];
  });
}

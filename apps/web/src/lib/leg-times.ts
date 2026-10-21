import { splitLine, type Stop } from "./admin/legs";
import { climbM, elevationsOf, lengthKm, type LngLatEle } from "./admin/line";
import { estimateWalkMinutes } from "./admin/walk-time";

// How long it takes to walk from one stop to the next, from the line between them (the rule is walk-time.ts's, the same
// as Navivi's). Pure, so the editor and the public pages show the same numbers.

export interface LegTime {
  km: number;
  /** Rounded to 5 minutes, at least 5. */
  minutes: number;
}

/** The time of one stretch of line; null when it has no length. */
export function legTime(points: readonly LngLatEle[]): LegTime | null {
  const km = lengthKm(points);
  const eles = elevationsOf([...points]);
  const minutes = estimateWalkMinutes(km, eles ? climbM(eles) : null);
  return minutes === null ? null : { km, minutes };
}

/**
 * The time from each place to the next one along the route, by place id: the line cut at the places (side trips are not on
 * the line, so they are left out). A place has no entry when the places do not follow the line (a wrong order, or far from
 * it), so a time is never made up from a line that does not fit.
 */
export function timesFromPrevious(
  places: readonly { id: string; position: { lat: number; lng: number } | null; stopBy?: boolean }[],
  line: readonly LngLatEle[],
): Map<string, LegTime> {
  const stops = places.flatMap((p): (Stop & { id: string })[] => (p.position && !p.stopBy ? [{ key: p.id, id: p.id, lat: p.position.lat, lng: p.position.lng }] : []));
  const out = new Map<string, LegTime>();
  splitLine(stops, line).forEach((leg) => {
    const time = legTime(leg.points);
    if (time) out.set(leg.to, time);
  });
  return out;
}

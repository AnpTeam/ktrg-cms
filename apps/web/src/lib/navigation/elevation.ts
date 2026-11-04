// The climb between the visitor and the next stop, for the elevation strip (docs/navigation-plan.md, N6). Pure: it reads
// the elevations the course line already carries (a point is [lng, lat, ele]); no network, no coordinates kept.

import { climbM, descentM } from "../admin/line";
import type { LinePoint } from "./geometry";

export interface LegProfile {
  /** Elevations in metres, evenly spaced along the leg, in the direction of walking (left to right). */
  elevations: number[];
  climbM: number;
  descentM: number;
}

/** Fewer ups and downs than this over a leg is "flat": no strip is shown. */
const FLAT_M = 5;

/**
 * The elevation profile between two places on a line, `fromM` to `toM` metres along it (either order: the result
 * follows the direction of walking). Null when the line has no elevation for that stretch, or it is flat.
 */
export function legProfile(line: readonly LinePoint[], cum: readonly number[], fromM: number, toM: number, samples = 40): LegProfile | null {
  const lo = Math.max(0, Math.min(fromM, toM));
  const hi = Math.min(cum[cum.length - 1] ?? 0, Math.max(fromM, toM));
  if (line.length < 2 || hi - lo < 20 || samples < 2) return null;

  const eleAt = (d: number): number | null => {
    let i = 0;
    while (i + 2 < line.length && cum[i + 1]! < d) i++;
    const a = line[i]![2];
    const b = line[i + 1]![2];
    if (typeof a !== "number" || typeof b !== "number") return null;
    const seg = cum[i + 1]! - cum[i]!;
    return seg === 0 ? a : a + ((b - a) * (d - cum[i]!)) / seg;
  };

  const out: number[] = [];
  for (let k = 0; k < samples; k++) {
    const e = eleAt(lo + ((hi - lo) * k) / (samples - 1));
    if (e === null) return null;
    out.push(e);
  }
  if (Math.max(...out) - Math.min(...out) < FLAT_M) return null;
  const elevations = fromM <= toM ? out : out.reverse();
  return { elevations, climbM: climbM(elevations), descentM: descentM(elevations) };
}

import { sampleDrawnPath, type AnchorCurve } from "./drawn-path";
import { closeGaps, gsiPath, type LatLng } from "./gsi-paths";
import { simplify, type LngLatEle } from "./line";
import { roundLine, type SnapPoint } from "./snap";

// How the map editor makes a line from stops and from rough drawings, with the pieces taken from Navivi: GSI's trail
// network (gsi-paths.ts, no key) finds the way between stops, and the Bezier maths (drawn-path.ts) makes a hand-drawn
// line smooth. Navivi chains a leg per pair of stops the same way (its useMapRouting hook); here one line is built.

export type Bridge = (from: LatLng, to: LatLng) => Promise<LatLng[] | null>;

const toLatLng = (p: SnapPoint): LatLng => [p.lat, p.lng];
const toLine = (points: readonly LatLng[]): LngLatEle[] => {
  const out: LngLatEle[] = [];
  for (const [lat, lng] of points) {
    const last = out.at(-1);
    if (!last || last[0] !== lng || last[1] !== lat) out.push([lng, lat]);
  }
  return roundLine(out);
};

/**
 * A line through the stops in order. "trail": every hop follows GSI's paths where the map has one (and counts as
 * straight where it has none, so the person is told); "direct": straight hops.
 */
export async function buildLine(stops: readonly SnapPoint[], mode: "trail" | "direct", bridge: Bridge = gsiPath): Promise<{ line: LngLatEle[]; straightHops: number }> {
  if (stops.length < 2) return { line: [], straightHops: 0 };
  const points = stops.map(toLatLng);
  const out: LatLng[] = [points[0]!];
  let straightHops = 0;
  for (let i = 1; i < points.length; i++) {
    const hop = mode === "trail" ? await bridge(points[i - 1]!, points[i]!) : null;
    if (mode === "trail" && !hop) straightHops++;
    out.push(...(hop ?? []), points[i]!);
  }
  return { line: toLine(out), straightHops };
}

/** A router's line (already [lng, lat]) with the stretch it left short of the first and last stop filled in from GSI's paths. */
export async function closeLineGaps(line: readonly LngLatEle[], stops: readonly SnapPoint[], bridge: Bridge = gsiPath): Promise<LngLatEle[]> {
  if (line.length < 2 || stops.length < 2) return [...line];
  const filled = await closeGaps(line.map((p): LatLng => [p[1], p[0]]), stops.map(toLatLng), bridge);
  return toLine(filled);
}

/** The line with its corners rounded: thinned to a few anchors, each made smooth, then sampled along the curves. */
export function smoothLine(line: readonly LngLatEle[], anchors = 40): LngLatEle[] {
  if (line.length < 3) return [...line];
  const nodes = simplify(line, anchors).map((p): LatLng => [p[1], p[0]]);
  const curves: AnchorCurve[] = Array.from({ length: nodes.length - 2 }, () => "auto");
  return toLine(sampleDrawnPath(nodes, curves));
}

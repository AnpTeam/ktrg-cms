import { isAllSmooth, sampleDrawnPath, type AnchorCurve } from "./drawn-path";
import { distanceM, simplify, type LngLatEle } from "./line";
import { roundLine } from "./snap";

// The route line as Navivi keeps it: not one long line, but one leg for each pair of neighbouring stops (a stop is a
// waypoint with a position that is not a side trip). A leg can be hand-drawn (anchors with sharp or smooth corners, Navivi's
// drawnPath), found on trails, straight, or cut out of an imported track, and redrawing one never touches the others.
// The whole line the rest of the app reads is the legs joined in order. Pure, so it is tested without a browser.

type LatLng = [lat: number, lng: number];

/** A waypoint that the line passes through, in order. */
export interface Stop {
  key: string;
  lat: number;
  lng: number;
}

/** A stretch that is ridden, not walked: how, and the minutes the editor typed. */
export const RIDE_MODES = ["ferry", "bus", "train", "other"] as const;
export type RideMode = (typeof RIDE_MODES)[number];
export interface Ride {
  mode: RideMode;
  minutes: number;
}

export interface Leg {
  /** The keys of the two stops this leg runs between. */
  from: string;
  to: string;
  /** The leg as points, both ends exactly on the stops. This is what is saved. */
  points: LngLatEle[];
  /** Only while it is being edited: the hand-drawn anchors between the stops, and how each bends the path (Navivi's anchors). */
  anchors?: LatLng[];
  curves?: AnchorCurve[];
  /** A side trip (寄り道): out from a stop of the route to a stop-by place. It is not part of the joined line. */
  side?: true;
  /** Ridden, not walked (a ferry from a port ...): visitors read this time instead of a walking estimate. */
  ride?: Ride;
  /**
   * Guide points ([lng, lat], in walking order from the first stop to the second): invisible marks the route-finding service is
   * given between the two stops, so it cannot pick a shorter but worse way (Navivi's via points). Visitors never see them.
   */
  via?: GuidePoint[];
}

export type GuidePoint = [lng: number, lat: number];
/** The most guide points one leg may have (the API accepts the same, and the routing service takes 50 points in all). */
export const MAX_GUIDE_POINTS = 20;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * The guide points with a new one added. They stay in walking order: the new point goes where it adds the least walking (a
 * point placed beside the stretch between two guide points goes between them).
 */
export function insertGuidePoint(from: Stop, to: Stop, via: readonly GuidePoint[], pos: GuidePoint): GuidePoint[] {
  const point: GuidePoint = [round6(pos[0]), round6(pos[1])];
  const chain: GuidePoint[] = [[from.lng, from.lat], ...via, [to.lng, to.lat]];
  let best = 0;
  let bestCost = Infinity;
  for (let i = 0; i < chain.length - 1; i++) {
    const cost = distanceM(chain[i]!, point) + distanceM(point, chain[i + 1]!) - distanceM(chain[i]!, chain[i + 1]!);
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  const out = [...via];
  out.splice(best, 0, point);
  return out;
}

export const moveGuidePoint = (via: readonly GuidePoint[], index: number, pos: GuidePoint): GuidePoint[] => via.map((p, i): GuidePoint => (i === index ? [round6(pos[0]), round6(pos[1])] : p));
export const removeGuidePoint = (via: readonly GuidePoint[], index: number): GuidePoint[] => via.filter((_, i) => i !== index);

/** What the routing service is asked to route through: the first stop, the guide points in order, the second stop. */
export const guideRoute = (from: Stop, to: Stop, via: readonly GuidePoint[] = []): { lat: number; lng: number }[] => [
  { lat: from.lat, lng: from.lng },
  ...via.map(([lng, lat]) => ({ lat, lng })),
  { lat: to.lat, lng: to.lng },
];

/** The most points the whole line may have (the API keeps the line at this size too). */
export const LINE_BUDGET = 2000;
/** The most points one hand-drawn leg may have before it is thinned. */
const LEG_MAX = 1500;

export const stopOf = (p: { key: string; lat: number | null; lng: number | null; stopBy: boolean }): Stop | null =>
  p.stopBy || p.lat === null || p.lng === null ? null : { key: p.key, lat: p.lat, lng: p.lng };

/** The stops of a route in order: placed waypoints, side trips left out. */
export const pathStops = (places: readonly { key: string; lat: number | null; lng: number | null; stopBy: boolean }[]): Stop[] =>
  places.flatMap((p) => {
    const s = stopOf(p);
    return s ? [s] : [];
  });

export const pairsOf = (stops: readonly Stop[]): { from: Stop; to: Stop }[] => stops.slice(1).map((to, i) => ({ from: stops[i]!, to }));

/**
 * The side trips: for each placed stop-by waypoint, a pair from the stop before it in the list (a junction waypoint put just
 * before it in the list is how the branch point is chosen) to the stop-by place. One before the first stop has none.
 */
export function sidePairs(places: readonly { key: string; lat: number | null; lng: number | null; stopBy: boolean }[]): { from: Stop; to: Stop }[] {
  const out: { from: Stop; to: Stop }[] = [];
  let last: Stop | null = null;
  for (const p of places) {
    if (p.lat === null || p.lng === null) continue;
    const here = { key: p.key, lat: p.lat, lng: p.lng };
    if (p.stopBy) {
      if (last) out.push({ from: last, to: here });
    } else last = here;
  }
  return out;
}

const at = (s: Stop): LngLatEle => [s.lng, s.lat];
const sameSpot = (a: readonly (number | undefined)[], b: readonly (number | undefined)[]) => a[0] === b[0] && a[1] === b[1];

const toLine = (points: readonly LatLng[]): LngLatEle[] => {
  const out: LngLatEle[] = [];
  for (const [lat, lng] of points) {
    const last = out.at(-1);
    if (!last || last[0] !== lng || last[1] !== lat) out.push([lng, lat]);
  }
  return roundLine(out);
};

/** The leg a pair of stops has, if any. */
export const legOf = (legs: readonly Leg[], from: string, to: string) => legs.find((l) => l.from === from && l.to === to);

// ---- the legs as one line ------------------------------------------------------------------------------------------

/** Where each leg's points sit in the joined line. A pair without a leg is a straight hop and has no piece. */
export interface Piece {
  from: string;
  to: string;
  start: number;
  /** The leg's own first point is the previous leg's last point, so it is not repeated. */
  skipFirst: boolean;
  length: number;
}

/** The legs joined in order into one line; a pair of stops without a leg is bridged by a straight hop. */
export function joinLegs(stops: readonly Stop[], legs: readonly Leg[]): { line: LngLatEle[]; pieces: Piece[] } {
  const line: LngLatEle[] = [];
  const pieces: Piece[] = [];
  for (const { from, to } of pairsOf(stops)) {
    const leg = legOf(legs, from.key, to.key);
    const seg: LngLatEle[] = leg ? leg.points : [at(from), at(to)];
    const last = line.at(-1);
    const skip = !!last && sameSpot(last, seg[0]!);
    const add = skip ? seg.slice(1) : seg;
    if (leg) pieces.push({ from: from.key, to: to.key, start: line.length, skipFirst: skip, length: add.length });
    line.push(...add);
  }
  return { line, pieces };
}

/**
 * Hands a joined line back to the legs it came from (the same line with elevations filled in): each leg takes its stretch.
 * Null when the line is not the one the legs make (it changed in the meantime).
 */
export function legsFromJoined(stops: readonly Stop[], legs: readonly Leg[], line: readonly LngLatEle[]): Leg[] | null {
  const joined = joinLegs(stops, legs);
  if (joined.line.length !== line.length || !joined.line.every((p, i) => sameSpot(p, line[i]!))) return null;
  return legs.map((leg) => {
    const piece = joined.pieces.find((p) => p.from === leg.from && p.to === leg.to);
    if (!piece) return leg;
    const taken = line.slice(piece.start, piece.start + piece.length);
    return { ...leg, points: piece.skipFirst ? [line[piece.start - 1]!, ...taken] : [...taken] };
  });
}

// ---- keeping the legs in step with the stops ------------------------------------------------------------------------

/** A leg whose stops moved: rebuilt from its anchors, or (a leg made of plain points) with just its two ends moved. */
function refit(leg: Leg, from: Stop, to: Stop): Leg {
  const [a, b] = [leg.points[0]!, leg.points.at(-1)!];
  if (sameSpot(a, at(from)) && sameSpot(b, at(to))) return leg;
  if (leg.anchors) return { ...leg, points: capPoints(pointsFromAnchors(from, to, leg.anchors, leg.curves ?? leg.anchors.map(() => null))) };
  const inner = leg.points.slice(1, -1);
  return { ...leg, points: [at(from), ...inner, at(to)] };
}

/**
 * The legs that still fit the stops: a leg stays while both its stops are neighbours, with its ends on the stops. When a stop
 * was taken out between two neighbours, their two legs are joined into one.
 */
export function reconcileLegs(stops: readonly Stop[], legs: readonly Leg[], sides: readonly { from: Stop; to: Stop }[] = []): Leg[] {
  const keys = new Set(stops.map((s) => s.key));
  const out: Leg[] = [];
  for (const { from, to } of pairsOf(stops)) {
    const own = legOf(legs, from.key, to.key);
    if (own) {
      // A place that stopped being a stop-by keeps its stretch, now as part of the route.
      const fitted = refit(own, from, to);
      out.push(fitted.side ? { from: fitted.from, to: fitted.to, points: fitted.points, anchors: fitted.anchors, curves: fitted.curves } : fitted);
      continue;
    }
    const first = legs.find((l) => l.from === from.key && !l.side && !keys.has(l.to));
    const second = first && legs.find((l) => l.from === first.to && l.to === to.key);
    if (first && second) out.push({ from: from.key, to: to.key, points: capPoints([...first.points, ...second.points.slice(1)]) });
  }
  // Side trips keep their own stretch while their pair stands; one whose pair is gone is dropped.
  for (const { from, to } of sides) {
    const own = legOf(legs, from.key, to.key);
    if (!own) continue;
    const fitted = refit(own, from, to);
    out.push(fitted.side ? fitted : { ...fitted, side: true });
  }
  return out.length === legs.length && out.every((l, i) => l === legs[i]) ? (legs as Leg[]) : out;
}


// ---- cutting a whole line into legs ---------------------------------------------------------------------------------

/** A stop farther than this from the line is not on it. */
const ON_LINE_M = 300;
/** A stop whose nearest point lies this far behind the previous stop's (along the line) is out of order. */
const BEHIND_M = 400;

/**
 * Whether the stops follow the line: each is close to it, and they come in the order the line runs (a small step back, for a
 * viewpoint on a spur, is fine). A list with a stop twice or in another order than the path does not.
 */
export function stopsFollowLine(stops: readonly Stop[], line: readonly LngLatEle[]): boolean {
  if (stops.length < 2 || line.length < 2) return false;
  const along = [0];
  for (let j = 1; j < line.length; j++) along.push(along[j - 1]! + distanceM(line[j - 1]!, line[j]!));
  let behind = -Infinity;
  for (const s of stops) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < line.length; j++) {
      const d = distanceM(line[j]!, [s.lng, s.lat]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (bestD > ON_LINE_M || behind - along[best]! > BEHIND_M) return false;
    behind = Math.max(behind, along[best]!);
  }
  return true;
}

/**
 * Cuts a line (an imported track, an old route that was drawn in one piece) into one leg for each pair of stops: each stop
 * takes the nearest point of the line that is not before the previous stop's. What lies before the first stop and after
 * the last is left out. Fewer than two stops or a line with fewer than two points: no legs. When the stops do not follow the
 * line (see stopsFollowLine) no legs either, so a good line is never turned into straight hops; `force` cuts anyway.
 */
export function splitLine(stops: readonly Stop[], line: readonly LngLatEle[], opts: { force?: boolean } = {}): Leg[] {
  if (stops.length < 2 || line.length < 2) return [];
  if (!opts.force && !stopsFollowLine(stops, line)) return [];
  const index: number[] = [];
  let from = 0;
  for (const s of stops) {
    let best = from;
    let bestD = Infinity;
    for (let j = from; j < line.length; j++) {
      const d = distanceM(line[j]!, [s.lng, s.lat]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    index.push(best);
    from = best;
  }
  return capLegs(
    pairsOf(stops).map(({ from: a, to: b }, i) => {
      const [i0, i1] = [index[i]!, index[i + 1]!];
      return { from: a.key, to: b.key, points: [at(a), ...line.slice(i0 + 1, i1), at(b)] };
    }),
  );
}

/** The legs thinned so that, together, they have about `budget` points (a long leg keeps more than a short one). */
export function capLegs(legs: readonly Leg[], budget = LINE_BUDGET): Leg[] {
  const total = legs.reduce((n, l) => n + l.points.length, 0);
  if (total <= budget) return [...legs];
  return legs.map((l) => ({ ...l, points: simplify(l.points, Math.max(12, Math.floor((budget * l.points.length) / total))) }));
}

const capPoints = (points: LngLatEle[]) => simplify(points, LEG_MAX);

// ---- hand-drawn legs (anchors), after Navivi's drawnPath -------------------------------------------------------------

/** The leg's points from its anchors: Bezier curves where an anchor is smooth, straight where it is a corner. */
export function pointsFromAnchors(from: Stop, to: Stop, anchors: readonly LatLng[], curves: readonly AnchorCurve[]): LngLatEle[] {
  const line = toLine(sampleDrawnPath([[from.lat, from.lng], ...anchors, [to.lat, to.lng]], [...curves]));
  // The points are rounded, the stops are not: put both ends exactly on the stops, or the leg would look moved every time.
  return line.length < 2 ? [at(from), at(to)] : [at(from), ...line.slice(1, -1), at(to)];
}

/** Anchors for editing a leg that has none yet (found on trails, imported): its shape thinned to a few points, all corners. */
export function anchorsFromPoints(points: readonly LngLatEle[], max = 30): LatLng[] {
  if (points.length < 3) return [];
  return simplify(points, max).slice(1, -1).map((p): LatLng => [p[1], p[0]]);
}

export interface Path {
  anchors: LatLng[];
  curves: AnchorCurve[];
}

/** The anchors and curves a leg is edited with: its own, or ones worked out from its points. */
export function pathOfLeg(leg: Leg): Path {
  const anchors = leg.anchors ?? anchorsFromPoints(leg.points);
  const curves = leg.curves && leg.curves.length === anchors.length ? leg.curves : anchors.map((): AnchorCurve => null);
  return { anchors, curves };
}

/** The leg a path makes between two stops. */
export function legFromPath(from: Stop, to: Stop, path: Path): Leg {
  const curved = path.curves.some((c) => c !== null);
  return {
    from: from.key,
    to: to.key,
    points: capPoints(pointsFromAnchors(from, to, path.anchors, path.curves)),
    anchors: path.anchors,
    ...(curved ? { curves: path.curves } : {}),
  };
}

// A point added to a path that is smooth all the way along is smooth too.
export function insertAnchor(path: Path, index: number, pos: LatLng): Path {
  const anchors = [...path.anchors];
  const curves = [...path.curves];
  const smooth = isAllSmooth(curves);
  anchors.splice(index, 0, pos);
  curves.splice(index, 0, smooth ? "auto" : null);
  return { anchors, curves };
}

export const moveAnchor = (path: Path, index: number, pos: LatLng): Path => ({ anchors: path.anchors.map((a, i) => (i === index ? pos : a)), curves: path.curves });

export const removeAnchors = (path: Path, indexes: ReadonlySet<number>): Path => ({
  anchors: path.anchors.filter((_, i) => !indexes.has(i)),
  curves: path.curves.filter((_, i) => !indexes.has(i)),
});

export const toggleAnchorCurve = (path: Path, index: number): Path => ({ anchors: path.anchors, curves: path.curves.map((c, i): AnchorCurve => (i === index ? (c ? null : "auto") : c)) });

export const setAllCurves = (path: Path, smooth: boolean): Path => ({ anchors: path.anchors, curves: path.anchors.map((): AnchorCurve => (smooth ? "auto" : null)) });

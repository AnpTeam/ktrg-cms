// The maths of a hand-drawn path with smooth corners: each anchor may be a sharp corner or a smooth curve whose handles
// are worked out from its neighbours, and the path is sampled into dense points along cubic Bezier curves.
//
// Ported from Navivi (src/utils/drawnPath.ts, with fillRouteCoordinates and getDistanceKm from src/utils/mapUtils.ts):
// the same functions, with the Waypoint type replaced by the two fields they read. Navivi's anchor editing helpers
// (insert, move, reorder ...) are not here: the map editor edits anchors with Terra Draw.

type LatLng = [number, number];
type Handles = { in: LatLng; out: LatLng };
/** How a drawn anchor bends the path: null = sharp corner, "auto" = smooth with handles worked out from its neighbours, an object = handles the user dragged. */
export type AnchorCurve = "auto" | { in: [number, number]; out: [number, number] } | null;

export const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // earth radius
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// 🛠️ Fills in empty space between two coordinates to mimic high-res API data
export function fillRouteCoordinates(points: [number, number][], intervalKm: number = 0.01): [number, number][] {
  if (points.length < 2) return points;
  
  const densePath: [number, number][] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    
    // Always push the start point of this segment
    densePath.push(p1);
    
    const dist = getDistanceKm(p1[0], p1[1], p2[0], p2[1]);
    
    // If the gap is larger than our interval (e.g., 10 meters), fill it with micro-points!
    if (dist > intervalKm) {
      const steps = Math.floor(dist / intervalKm);
      for (let j = 1; j <= steps; j++) {
        const fraction = j / (steps + 1);
        const lat = p1[0] + (p2[0] - p1[0]) * fraction;
        const lng = p1[1] + (p2[1] - p1[1]) * fraction;
        densePath.push([lat, lng]);
      }
    }
  }
  
  // Push the very final point
  densePath.push(points[points.length - 1]!);
  
  return densePath;
}
const lngScale = (lat: number) => Math.max(0.05, Math.cos((lat * Math.PI) / 180));

// The curve of every anchor in wp.customRoute. A stored array that no longer fits the anchors is ignored; an old
// "spline" leg without one reads as every anchor smooth.
export function curvesOf(wp: { customRoute?: [number, number][]; customRouteCurve?: AnchorCurve[]; drawStyle?: "linear" | "spline" }): AnchorCurve[] {
  const n = wp.customRoute?.length ?? 0;
  if (wp.customRouteCurve && wp.customRouteCurve.length === n) return wp.customRouteCurve;
  return Array.from({ length: n }, () => (wp.drawStyle === "spline" ? "auto" : null));
}

export const isCurved = (curves: AnchorCurve[]) => curves.some((c) => c !== null);
export const isAllSmooth = (curves: AnchorCurve[]) => curves.length > 0 && curves.every((c) => c !== null);

function autoHandles(prev: LatLng, p: LatLng, next: LatLng): Handles {
  const k = lngScale(p[0]);
  const toNext: LatLng = [next[0] - p[0], (next[1] - p[1]) * k];
  const toPrev: LatLng = [prev[0] - p[0], (prev[1] - p[1]) * k];
  const t: LatLng = [toNext[0] - toPrev[0], toNext[1] - toPrev[1]];
  const len = Math.hypot(t[0], t[1]);
  if (len === 0) return { in: [0, 0], out: [0, 0] };
  const u: LatLng = [t[0] / len, t[1] / len];
  const dNext = Math.hypot(toNext[0], toNext[1]) / 3;
  const dPrev = Math.hypot(toPrev[0], toPrev[1]) / 3;
  return { out: [u[0] * dNext, (u[1] * dNext) / k], in: [-u[0] * dPrev, (-u[1] * dPrev) / k] };
}

// Handle offsets of each node in [from, ...anchors, to]; stops never have handles, corner anchors neither.
export function handlesFor(nodes: LatLng[], curves: AnchorCurve[]): (Handles | null)[] {
  return nodes.map((p, i) => {
    const c = i === 0 || i === nodes.length - 1 ? null : curves[i - 1];
    if (!c) return null;
    return c === "auto" ? autoHandles(nodes[i - 1]!, p, nodes[i + 1]!) : c;
  });
}

// The leg as dense points, one cubic Bezier per stretch between nodes (a straight fill when neither end has a handle).
export function sampleDrawnPath(nodes: LatLng[], curves: AnchorCurve[], stepKm = 0.01): LatLng[] {
  if (nodes.length < 2 || !isCurved(curves)) return fillRouteCoordinates(nodes, stepKm);
  const handles = handlesFor(nodes, curves);
  const out: LatLng[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[i]!;
    const p3 = nodes[i + 1]!;
    const h0 = handles[i];
    const h3 = handles[i + 1];
    if (!h0 && !h3) {
      out.push(...fillRouteCoordinates([p0, p3], stepKm).slice(0, -1));
      continue;
    }
    const c1: LatLng = h0 ? [p0[0] + h0.out[0], p0[1] + h0.out[1]] : p0;
    const c2: LatLng = h3 ? [p3[0] + h3.in[0], p3[1] + h3.in[1]] : p3;
    const reach = getDistanceKm(p0[0], p0[1], c1[0], c1[1]) + getDistanceKm(c1[0], c1[1], c2[0], c2[1]) + getDistanceKm(c2[0], c2[1], p3[0], p3[1]);
    const steps = Math.min(3000, Math.max(8, Math.ceil(reach / stepKm)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]]);
    }
  }
  out.push(nodes[nodes.length - 1]!);
  return out;
}

import type { SpotStatus } from "./content";
import type { Position } from "./map";

// The pure parts of the home map (WBS 3.2.10): the area drawn for each course, and the heights the bottom sheet
// can rest at. No React and no map library, so they are unit-tested.

/**
 * Where a course is, as one round area on the overview map (a centre and a radius). The CMS holds it per course;
 * `verified` is false for a rough placement (sample data), and the map then says so.
 */
export interface RouteArea extends Position {
  radiusM: number;
  verified: boolean;
}

/** A stop on a course's detailed map, with what its bottom sheet shows. Sent to the browser, so plain data only. */
export interface HomeStop {
  id: string;
  /** 1, 2, 3 ... in walking order. */
  order: number;
  name: string;
  nameLang: "ja" | "en";
  /** The spoken name of the marker, for example "3. 猿坂峠, stamped". */
  label: string;
  position: Position;
  /** null when signed out. */
  stamped: boolean | null;
  status: SpotStatus;
  /** The spot's own page, with the locale. */
  href: string;
  description: string | null;
  statusNote: string | null;
  /** ISO timestamp of the last status change. */
  statusUpdatedAt: string | null;
}

/** One course as the home map needs it. Texts are already in the visitor's language. */
export interface HomeRoute {
  id: string;
  /** 1 to 19, from Tomogashima to Kamenose. */
  order: number;
  name: string;
  nameLang: "ja" | "en";
  prefecture: "osaka" | "wakayama" | "nara" | null;
  municipality: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  expectedTimeMin: number | null;
  difficulty: string | null;
  /** "soon" = no published spots yet. */
  status: "ready" | "soon";
  spotCount: number;
  /** null when signed out. */
  stampedCount: number | null;
  area: RouteArea | null;
  elevations: number[] | null;
  /** The course page, with the locale. */
  href: string;
  /** The detailed map: only courses that have positions for their stops. */
  stops: HomeStop[] | null;
  line: Position[] | null;
  /** Some position on this course is a rough draft, not a verified one. */
  draft: boolean;
}

const EARTH_RADIUS_M = 6_371_008.8;

/** A closed ring of points around a centre, `radiusM` away (a polygon close enough to a circle for a map). */
export function circlePolygon(center: Position, radiusM: number, steps = 48): Position[] {
  const lat = (center.lat * Math.PI) / 180;
  const ring: Position[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / EARTH_RADIUS_M;
    const dLng = (radiusM * Math.sin(angle)) / (EARTH_RADIUS_M * Math.cos(lat));
    ring.push({ lat: center.lat + (dLat * 180) / Math.PI, lng: center.lng + (dLng * 180) / Math.PI });
  }
  ring.push(ring[0] as Position);
  return ring;
}

export interface AreaCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; order: number; selected: boolean };
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
  }[];
}

/** The areas to draw. With a course chosen only its own area is drawn: the others fold away. */
export function areaCollection(routes: readonly HomeRoute[], selectedId: string | null): AreaCollection {
  const shown = routes.filter((r) => r.area !== null && (selectedId === null || r.id === selectedId));
  return {
    type: "FeatureCollection",
    features: shown.map((r) => ({
      type: "Feature",
      properties: { id: r.id, order: r.order, selected: r.id === selectedId },
      geometry: { type: "Polygon", coordinates: [circlePolygon(r.area as RouteArea, (r.area as RouteArea).radiusM).map((p): [number, number] => [p.lng, p.lat])] },
    })),
  };
}

/** The points that frame a chosen course: its stops and path when it has them, else its area's edge. */
export function framePoints(route: HomeRoute): Position[] {
  const detail = [...(route.stops?.map((s) => s.position) ?? []), ...(route.line ?? [])];
  if (detail.length > 0) return detail;
  return route.area ? circlePolygon(route.area, route.area.radiusM, 12) : [];
}

// ---- The bottom sheet ----------------------------------------------------------------------------------------

export type SheetSnap = "peek" | "half" | "full";
export const sheetSnaps: readonly SheetSnap[] = ["peek", "half", "full"];

/** How tall each resting place is, as a share of the room above the tab bar. */
export const SNAP_FRACTION: Record<SheetSnap, number> = { peek: 0.3, half: 0.56, full: 0.94 };

export function sheetHeightPx(snap: SheetSnap, available: number): number {
  return Math.round(SNAP_FRACTION[snap] * available);
}

/**
 * Where a drag ends. `heightPx` is where the finger let go; `velocity` is how fast it was moving, in px per
 * second, positive when the sheet was being pulled up. A quick flick goes one step in its direction; a slow drag
 * goes to the nearest resting place.
 */
export function snapAfterDrag(heightPx: number, velocity: number, available: number, from: SheetSnap): SheetSnap {
  const FLICK = 600;
  const index = sheetSnaps.indexOf(from);
  if (Math.abs(velocity) >= FLICK) {
    const step = velocity > 0 ? 1 : -1;
    return sheetSnaps[Math.min(sheetSnaps.length - 1, Math.max(0, index + step))] as SheetSnap;
  }
  let best: SheetSnap = "peek";
  let bestDistance = Infinity;
  for (const snap of sheetSnaps) {
    const d = Math.abs(sheetHeightPx(snap, available) - heightPx);
    if (d < bestDistance) {
      best = snap;
      bestDistance = d;
    }
  }
  return best;
}

/** The next resting place when the handle is tapped: up, and back down after the top. */
export function nextSnap(snap: SheetSnap): SheetSnap {
  return snap === "peek" ? "half" : snap === "half" ? "full" : "peek";
}

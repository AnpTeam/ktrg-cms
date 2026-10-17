import type { SpotStatus } from "./content";
import type { Position } from "./map";

// The pure parts of the home map (WBS 3.2.10): the area drawn for each course, and the heights the bottom sheet
// can rest at. No React and no map library, so they are unit-tested.

/**
 * Where a course is, as one outlined rectangle on the map (its centre and its size in metres, edges running
 * east-west and north-south, like the boxes on the official map). The CMS holds it per course; `verified` is
 * false for a rough placement (sample data), and the map then says so.
 */
export interface RouteArea extends Position {
  widthM: number;
  heightM: number;
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

/** How far, in degrees, half of the area's height and width reach from its centre. */
function halfSpan(area: RouteArea): { dLat: number; dLng: number } {
  const lat = (area.lat * Math.PI) / 180;
  return {
    dLat: ((area.heightM / 2 / EARTH_RADIUS_M) * 180) / Math.PI,
    dLng: ((area.widthM / 2 / (EARTH_RADIUS_M * Math.cos(lat))) * 180) / Math.PI,
  };
}

/** The corners of an area, as a closed ring (the first point is repeated at the end). */
export function rectangleRing(area: RouteArea): Position[] {
  const { dLat, dLng } = halfSpan(area);
  const [s, n, w, e] = [area.lat - dLat, area.lat + dLat, area.lng - dLng, area.lng + dLng];
  return [
    { lat: s, lng: w },
    { lat: s, lng: e },
    { lat: n, lng: e },
    { lat: n, lng: w },
    { lat: s, lng: w },
  ];
}

/** Is this point inside the area? */
export function areaContains(area: RouteArea, point: Position): boolean {
  const { dLat, dLng } = halfSpan(area);
  return Math.abs(point.lat - area.lat) <= dLat && Math.abs(point.lng - area.lng) <= dLng;
}

/**
 * The course whose area is under the middle of the map, once the map is zoomed in far enough to be "inside" it
 * (and only a course that has stops to show). That course's stops appear without anyone choosing it. With two
 * areas overlapping, the one whose centre is nearer wins.
 */
export function revealedRouteId(routes: readonly HomeRoute[], center: Position, zoom: number, minZoom: number): string | null {
  if (zoom < minZoom) return null;
  let best: HomeRoute | null = null;
  let bestDistance = Infinity;
  for (const r of routes) {
    if (!r.area || !r.stops || r.stops.length === 0 || !areaContains(r.area, center)) continue;
    const d = Math.hypot(r.area.lat - center.lat, r.area.lng - center.lng);
    if (d < bestDistance) {
      best = r;
      bestDistance = d;
    }
  }
  return best?.id ?? null;
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
      geometry: { type: "Polygon", coordinates: [rectangleRing(r.area as RouteArea).map((p): [number, number] => [p.lng, p.lat])] },
    })),
  };
}

/** The points that frame a chosen course: its stops and path when it has them, else its area's edge. */
export function framePoints(route: HomeRoute): Position[] {
  const detail = [...(route.stops?.map((s) => s.position) ?? []), ...(route.line ?? [])];
  if (detail.length > 0) return detail;
  return route.area ? rectangleRing(route.area) : [];
}

// ---- Names beside the pins ----------------------------------------------------------------------------------------

/** The size, in px, of a pin's head and of the room its name takes up beside it (see .map-pin in globals.css). */
const PIN_W = 44;
const PIN_H = 56;
const LABEL_GAP = 4;
const LABEL_MAX_VERTICAL = 136; // 8.5rem: a longer name folds into another column
const LABEL_MAX_WIDTH = 120; // 7.5rem

/** About how big a name's label comes out. An estimate: it only has to keep names from covering each other. */
export function estimateLabel(name: string, vertical: boolean): { w: number; h: number } {
  const n = [...name].length;
  if (vertical) {
    const column = n * 19.2 + 10;
    const columns = Math.max(1, Math.ceil(column / LABEL_MAX_VERTICAL));
    return { w: columns * 18 + 13, h: Math.min(LABEL_MAX_VERTICAL, column) };
  }
  const w = Math.min(LABEL_MAX_WIDTH, n * 8 + 13);
  const lines = Math.max(1, Math.ceil((n * 8) / (LABEL_MAX_WIDTH - 13)));
  return { w, h: lines * 18 + 10 };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Which pins may show their name. `x` and `y` are where the pin's point is on screen. Every pin keeps its head;
 * a name is shown only if it clears all the heads and the names already shown, taking the pins in the order given
 * (lowest course number first), so two names never print over each other.
 */
export function namesThatFit(pins: readonly { id: string; x: number; y: number; name: string; vertical: boolean }[]): Set<string> {
  const heads: Box[] = pins.map((p) => ({ x: p.x - PIN_W / 2, y: p.y - PIN_H, w: PIN_W, h: PIN_H }));
  const placed: Box[] = [];
  const shown = new Set<string>();
  pins.forEach((p, i) => {
    const { w, h } = estimateLabel(p.name, p.vertical);
    const box: Box = { x: p.x + PIN_W / 2 + LABEL_GAP, y: p.y - PIN_H, w, h };
    const others = heads.filter((_, j) => j !== i);
    if ([...others, ...placed].some((o) => overlaps(box, o))) return;
    placed.push(box);
    shown.add(p.id);
  });
  return shown;
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

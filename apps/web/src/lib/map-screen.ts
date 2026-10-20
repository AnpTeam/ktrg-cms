import type { SpotStatus } from "./content";
import type { Position } from "./map";
import type { PlaceCategory } from "./places";
import type { PointKind } from "./point-kinds";

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

/** A photo for the top of a card, with the words a screen reader says for it. */
export interface MapPhoto {
  src: string;
  alt: string;
}

/** One stamp place of a course, as a row in its list (with or without a position on the map). */
export interface MapScreenSpot {
  id: string;
  order: number;
  name: string;
  nameLang: "ja" | "en";
  status: SpotStatus;
  /** null when signed out. */
  stamped: boolean | null;
  /** The spot's own page, with the locale. */
  href: string;
}

/** A stop on a course's detailed map, with what its bottom sheet shows. Sent to the browser, so plain data only. */
export interface MapScreenStop {
  id: string;
  /** 1, 2, 3 ... in walking order. */
  order: number;
  name: string;
  nameLang: "ja" | "en";
  /** The spoken name of the marker, for example "3. 猿坂峠, stamped". */
  label: string;
  position: Position;
  /** What the place is; the map can show the sutra mounds on their own. */
  kind?: PointKind;
  /** null when signed out. */
  stamped: boolean | null;
  status: SpotStatus;
  /** The spot's own page, with the locale. */
  href: string;
  description: string | null;
  statusNote: string | null;
  /** ISO timestamp of the last status change. */
  statusUpdatedAt: string | null;
  photo: MapPhoto | null;
}

/** A route's navigation point (a toilet, a turn, a viewpoint ...) shown on the map once the course is open and zoomed in. */
export interface MapScreenPoint {
  id: string;
  /** The place picture group it is drawn with (see lib/places.ts). */
  category: PlaceCategory;
  name: string;
  nameLang: "ja" | "en";
  position: Position;
}

/** One course as the home map needs it. Texts are already in the visitor's language. */
export interface MapScreenRoute {
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
  description: string | null;
  /** The story of the course, and how to get there; read by scrolling down in the course's sheet. */
  history: string | null;
  access: string | null;
  photo: MapPhoto | null;
  /** The course's photo and the photos of its places, for the gallery (the course's own first). */
  gallery: MapPhoto[];
  /** The course's navigation points that have a position. */
  points: MapScreenPoint[];
  /** Every stamp place of the course, in walking order (the detailed map below needs positions; this does not). */
  spots: MapScreenSpot[];
  /** The detailed map: only courses that have positions for their stops. */
  stops: MapScreenStop[] | null;
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
 * The course whose area is under the middle of the map, once the map is zoomed in far enough to be "inside" it.
 * That course is shown on its own (the others fold away, and its stops appear) without anyone choosing it. Where
 * two areas overlap, the one whose centre is nearer wins, so the courses are shown one at a time.
 */
export function revealedRouteId(routes: readonly MapScreenRoute[], center: Position, zoom: number, minZoom: number): string | null {
  if (zoom < minZoom) return null;
  let best: MapScreenRoute | null = null;
  let bestDistance = Infinity;
  for (const r of routes) {
    if (!r.area || !areaContains(r.area, center)) continue;
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
export function areaCollection(routes: readonly MapScreenRoute[], selectedId: string | null): AreaCollection {
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
export function framePoints(route: MapScreenRoute): Position[] {
  const detail = [...(route.stops?.map((s) => s.position) ?? []), ...(route.line ?? [])];
  if (detail.length > 0) return detail;
  return route.area ? rectangleRing(route.area) : [];
}

// ---- Names beside the pins ----------------------------------------------------------------------------------------

/** The size, in px, of a pin's head and of the room its name takes up beside it (see .map-pin in globals.css). */
const PIN_W = 44;
const PIN_H = 56;
const LABEL_GAP = 4;
const LABEL_MAX_WIDTH = 120; // 7.5rem

/** About how big a sideways name's label comes out. An estimate: it only has to keep names from covering each other. */
export function estimateLabel(name: string): { w: number; h: number } {
  const n = [...name].length;
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
export function namesThatFit(pins: readonly { id: string; x: number; y: number; name: string }[]): Set<string> {
  const heads: Box[] = pins.map((p) => ({ x: p.x - PIN_W / 2, y: p.y - PIN_H, w: PIN_W, h: PIN_H }));
  const placed: Box[] = [];
  const shown = new Set<string>();
  pins.forEach((p, i) => {
    const { w, h } = estimateLabel(p.name);
    const box: Box = { x: p.x + PIN_W / 2 + LABEL_GAP, y: p.y - PIN_H, w, h };
    const others = heads.filter((_, j) => j !== i);
    if ([...others, ...placed].some((o) => overlaps(box, o))) return;
    placed.push(box);
    shown.add(p.id);
  });
  return shown;
}

// ---- Pins that are too close ---------------------------------------------------------------------------------------

/**
 * How far apart, in screen pixels, two course pins must be to stay separate when the visitor chose to merge near places;
 * closer ones merge into one group. (A Japanese tag is narrow; a pin with its name beside it is wide, so it needs the
 * most room.)
 */
export const MERGE_PX = { tag: 40, pin: 50, namedPin: 120 } as const;

export interface LabelBox {
  id: string;
  /** The centre of the box on screen, in px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** About how big a merged group's label comes out: the count line plus each name on one or two lines. An estimate. */
export function estimateGroupBox(names: readonly string[]): { w: number; h: number } {
  const W = 176;
  const lines = names.reduce((n, name) => {
    const width = [...name].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e80 ? 14 : 8), 0);
    // Words wrap early, so the room is estimated generously: a label that is too roomy is harmless, one that is too small overlaps.
    return n + Math.max(1, Math.ceil(width / 130));
  }, 0);
  return { w: W + 12, h: 52 + lines * 18 };
}

/**
 * Moves group labels apart so none covers another, and keeps each inside `area` (the part of the map that is
 * visible: clear of the buttons at the top and the sheet at the bottom). Each box moves as little as it can; the
 * order of the input decides which way a tie is broken, so the same input always gives the same result. A box too big
 * for the area is pinned to its top-left corner.
 */
export function spreadLabels(boxes: readonly LabelBox[], area: { left: number; top: number; right: number; bottom: number }): LabelBox[] {
  const out = boxes.map((b) => ({ ...b }));
  const clamp = (b: LabelBox) => {
    const minX = area.left + b.w / 2;
    const maxX = Math.max(minX, area.right - b.w / 2);
    const minY = area.top + b.h / 2;
    const maxY = Math.max(minY, area.bottom - b.h / 2);
    b.x = Math.min(maxX, Math.max(minX, b.x));
    b.y = Math.min(maxY, Math.max(minY, b.y));
  };
  out.forEach(clamp);
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 - Math.abs(dy);
        if (overlapX <= 0.5 || overlapY <= 0.5) continue;
        moved = true;
        if (overlapX < overlapY) {
          const step = (overlapX / 2 + 0.5) * (dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx));
          a.x -= step;
          b.x += step;
        } else {
          const step = (overlapY / 2 + 0.5) * (dy === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dy));
          a.y -= step;
          b.y += step;
        }
      }
    }
    out.forEach(clamp);
    if (!moved) break;
  }
  return out;
}

/** The same for a course's stops. The accessibility choice 「まとめる」 merges them earlier; when it is off they still merge once they touch. */
export function stopMergePx(mergeEarly: boolean): number {
  return mergeEarly ? 56 : 40;
}

/**
 * The names printed in a merged group's label: as many as fit in `maxHeight` px (all of them when they fit), then how
 * many more there are. The rest are always in the sheet's list of courses, so no course is out of reach.
 */
export function groupLabelLines(names: readonly string[], maxHeight = Infinity): { lines: string[]; more: number } {
  let count = names.length;
  // Leave room for the "n more" line once something is left out.
  while (count > 1 && estimateGroupBox(names.slice(0, count)).h + (count < names.length ? 18 : 0) > maxHeight) count--;
  return { lines: names.slice(0, count), more: names.length - count };
}

// ---- The bottom sheet ----------------------------------------------------------------------------------------

export type SheetSnap = "peek" | "half" | "full";
export const sheetSnaps: readonly SheetSnap[] = ["peek", "half", "full"];

/** How tall each resting place is, as a share of the room above the tab bar. The top one covers the whole page. */
export const SNAP_FRACTION: Record<SheetSnap, number> = { peek: 0.3, half: 0.56, full: 1 };

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

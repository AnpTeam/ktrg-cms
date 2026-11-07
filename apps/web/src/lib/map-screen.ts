import type { WalkStyle } from "@/lib/walk-style";
import type { AccessPoint } from "./access-points";
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
import type { TechnicalLevel } from "./grading";
import type { StopRole } from "./route-stops";

export interface RouteArea extends Position {
  widthM: number;
  heightM: number;
  verified: boolean;
}

/** A photo for the top of a card, with the words a screen reader says for it. */
export interface MapPhoto {
  src: string;
  alt: string;
  /** Who took it / where it is from (may hold links), shown under the photo. */
  credit?: string | null;
}

/** One stamp place of a course, as a row in its list (with or without a position on the map). */
export interface MapScreenSpot {
  id: string;
  /** Its stamp number along the walk; null for a side trip and a place without a stamp. */
  order: number | null;
  name: string;
  nameLang: "ja" | "en";
  status: SpotStatus;
  /** null when signed out. */
  stamped: boolean | null;
  /** The spot's own page, with the locale. */
  href: string;
  photo: MapPhoto | null;
  /** How long from the place before; `mode` when that stretch is a ride, not a walk. */
  fromPrev?: { minutes: number; mode?: "ferry" | "bus" | "train" | "other" };
}

/** A stop on a course's detailed map, with what its bottom sheet shows. Sent to the browser, so plain data only. */
export interface MapScreenStop {
  id: string;
  /** 1, 2, 3 ... in walking order, stamp places only; null for a side trip and a place without a stamp. */
  order: number | null;
  name: string;
  nameLang: "ja" | "en";
  /** The spoken name of the marker, for example "3. 猿坂峠, stamped". */
  label: string;
  position: Position;
  /** What the place is; the map can show the sutra mounds on their own. */
  kind?: PointKind;
  /** An optional visit beside the way (寄り道): its pin has no number. */
  sideTrip?: boolean;
  /** A place where no stamp can be collected: a square pin, no stamp card in its sheet. */
  noStamp?: boolean;
  /** Where the walk starts and ends: the pin takes the Start (blue), Goal (orange) or both colours. */
  role?: StopRole;
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
  /** What its popup shows: a photo, a few words and the opening hours, when the place has them. */
  photo?: MapPhoto | null;
  description?: string | null;
  hours?: string | null;
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
  /** How far from the course counts as far (metres); null = the app's default. */
  farDistanceM: number | null;
  /** How to get there (train, bus ...), both languages; a position is here only once a person checked it. */
  accessPoints: AccessPoint[];
  difficulty: string | null;
  physicalLevel: number | null;
  technicalLevel: TechnicalLevel | null;
  /** One way, loop or there and back; known once the course has stops on the map. */
  walkStyle?: WalkStyle | null;
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
  /** Where the words come from (出典), in the visitor's language; may hold links. */
  source?: string | null;
  photo: MapPhoto | null;
  /** The course's photo and the photos of its places, for the gallery (the course's own first). */
  gallery: MapPhoto[];
  /** The course's navigation points that have a position. */
  points: MapScreenPoint[];
  /** Every stamp place of the course, in walking order (the detailed map below needs positions; this does not). */
  spots: MapScreenSpot[];
  /** The detailed map: only courses that have positions for their stops. */
  stops: MapScreenStop[] | null;
  /** The path. Not sent with the page (it is the heaviest part): the map fetches it when the course is chosen, see `hasLine`. */
  line: Position[] | null;
  /** The course has a path to fetch. */
  hasLine: boolean;
  /** Side trips (寄り道): short stretches out to stop-by places, sent with the page (they are small). */
  sideLines?: Position[][];
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

/** How far apart course dots are kept, in px: the 36 px disc and a small gap. More would push crowded dots out of trail order. */
export const COURSE_DOT_PX = 40;
const LABEL_MAX_WIDTH = 120; // 7.5rem, .map-dot-name

/** About how big a sideways name's label comes out. An estimate: it only has to keep names from covering each other. */
export function estimateLabel(name: string): { w: number; h: number } {
  const width = [...name].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e80 ? 14 : 8), 0); // Japanese is wider than Latin
  const w = Math.min(LABEL_MAX_WIDTH, width + 13);
  const lines = Math.max(1, Math.ceil(width / (LABEL_MAX_WIDTH - 13)));
  return { w, h: lines * 18 + 10 };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export type NameSide = "right" | "left" | "below" | "above";

/**
 * Which course dots may show their name, and on which side. `x` and `y` are the dot's centre on screen. Every course keeps
 * its dot; a name takes the first side that clears all the dots and the names already placed, taking them in the order
 * given (lowest course number first), so two names never print over each other. The trail runs from dot to dot, so the
 * right side is often taken by the next course. A side that runs out of `area` (the part of the map in view) is not free.
 * No free side: no name.
 */
export function namesThatFit(pins: readonly { id: string; x: number; y: number; name: string }[], area?: { left: number; top: number; right: number; bottom: number }): Map<string, NameSide> {
  const half = COURSE_DOT_PX / 2;
  const heads: Box[] = pins.map((p) => ({ x: p.x - half, y: p.y - half, w: COURSE_DOT_PX, h: COURSE_DOT_PX }));
  const placed: Box[] = [];
  const shown = new Map<string, NameSide>();
  pins.forEach((p, i) => {
    const { w, h } = estimateLabel(p.name);
    const others = heads.filter((_, j) => j !== i);
    const sides: [NameSide, Box][] = [
      ["right", { x: p.x + half, y: p.y - h / 2, w, h }],
      ["left", { x: p.x - half - w, y: p.y - h / 2, w, h }],
      ["below", { x: p.x - w / 2, y: p.y + half, w, h }],
      ["above", { x: p.x - w / 2, y: p.y - half - h, w, h }],
    ];
    const inView = (box: Box) => !area || (box.x >= area.left && box.y >= area.top && box.x + box.w <= area.right && box.y + box.h <= area.bottom);
    const free = sides.find(([, box]) => inView(box) && ![...others, ...placed].some((o) => overlaps(box, o)));
    if (!free) return;
    placed.push(free[1]);
    shown.set(p.id, free[0]);
  });
  return shown;
}

// ---- Pins that are too close ---------------------------------------------------------------------------------------

/**
 * How far apart, in screen pixels, two pins must be to stay separate when the visitor chose to merge near places;
 * closer ones merge into one group. (A pin with its name beside it is wide, so it needs the most room.)
 */
export const MERGE_PX = { pin: 50, namedPin: 120 } as const;

export type CourseDotState = "plain" | "done" | "soon";

/** How a course's dot looks. Signed out, stamps are not known, so no course is shown as finished. */
export function courseDotState(route: Pick<MapScreenRoute, "status" | "stampedCount" | "spotCount">): CourseDotState {
  if (route.status === "soon") return "soon";
  return route.stampedCount !== null && route.spotCount > 0 && route.stampedCount >= route.spotCount ? "done" : "plain";
}

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
  for (let round = 0; round < 120; round++) {
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

/**
 * The same for a course's stops. Stops merge only when the visitor chose 「近い場所をまとめて表示する」; otherwise every stop
 * keeps its own pin, and only pins that sit exactly on top of each other (a few px) share one, since they cannot be told apart.
 */
export function stopMergePx(mergeEarly: boolean): number {
  return mergeEarly ? 44 : 3;
}

/** Pins this close together (in metres) cannot be pulled apart by zooming: they are chosen from a list instead. */
export const SAME_PLACE_M = 30;

/** The widest distance, in metres, between the first of these points and any other (a straight line). */
export function spreadMeters(points: readonly Position[]): number {
  const first = points[0];
  if (!first) return 0;
  const rad = (d: number) => (d * Math.PI) / 180;
  return Math.max(
    0,
    ...points.slice(1).map((p) => {
      const h = Math.sin(rad(p.lat - first.lat) / 2) ** 2 + Math.cos(rad(first.lat)) * Math.cos(rad(p.lat)) * Math.sin(rad(p.lng - first.lng) / 2) ** 2;
      return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
    }),
  );
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

/** "hidden": pulled all the way down, so only the map shows (a button brings the sheet back). */
export type SheetSnap = "hidden" | "peek" | "half" | "full";
export const sheetSnaps: readonly SheetSnap[] = ["hidden", "peek", "half", "full"];

/** How tall each resting place is, as a share of the room above the tab bar. The top one covers the whole page. */
export const SNAP_FRACTION: Record<SheetSnap, number> = { hidden: 0, peek: 0.3, half: 0.56, full: 1 };

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

/** The next resting place when the handle is tapped: up, and from the top back to half, so a tap never drops it low (peek and hidden are pulls). */
export function nextSnap(snap: SheetSnap): SheetSnap {
  return snap === "half" ? "full" : "half";
}

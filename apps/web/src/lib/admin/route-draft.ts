import type { RouteDetail } from "../content";
import { areaFromBounds, sketchFromPoints } from "../route-geometry";
import { climbM, elevationsOf, lengthKm, type LngLatEle } from "./line";
import type { AdminRoute, AdminSpot, Prefecture, SpotStatus } from "./types";

// What the route editor holds while someone is typing and drawing: every field as the form shows it (text is "" when
// empty), the line as points, and the places in order. Pure, so the rules are tested without a browser.

export interface PlaceDraft {
  /** A client-side id, stable while the place is not saved yet (and equal to `id` once it is). */
  key: string;
  /** null until the place has been saved once. */
  id: string | null;
  updatedAt: string | null;
  published: boolean;
  nameJa: string;
  nameEn: string;
  descriptionJa: string;
  descriptionEn: string;
  lat: number | null;
  lng: number | null;
  positionVerified: boolean;
  positionSource: string;
  radiusM: number;
  status: SpotStatus;
  statusNoteJa: string;
  statusNoteEn: string;
  permissionConfirmed: boolean;
  permissionNote: string;
}

export interface RouteDraft {
  id: string | null;
  updatedAt: string | null;
  nameJa: string;
  nameEn: string;
  descriptionJa: string;
  descriptionEn: string;
  prefecture: Prefecture | null;
  municipality: string;
  distanceKm: number | null;
  /** True once someone typed a distance: drawing no longer overwrites it. */
  distanceManual: boolean;
  elevationGainM: number | null;
  climbManual: boolean;
  expectedTimeMin: number | null;
  difficulty: string;
  videoUrl: string;
  line: LngLatEle[];
  lineVerified: boolean;
  lineSource: string;
  places: PlaceDraft[];
}

export const emptyDraft = (): RouteDraft => ({
  id: null, updatedAt: null, nameJa: "", nameEn: "", descriptionJa: "", descriptionEn: "", prefecture: null, municipality: "",
  distanceKm: null, distanceManual: false, elevationGainM: null, climbManual: false, expectedTimeMin: null, difficulty: "",
  videoUrl: "", line: [], lineVerified: false, lineSource: "", places: [],
});

const s = (v: string | null) => v ?? "";

export function placeFromServer(p: AdminSpot): PlaceDraft {
  return {
    key: p.id, id: p.id, updatedAt: p.updatedAt, published: p.published,
    nameJa: p.nameJa, nameEn: s(p.nameEn), descriptionJa: s(p.descriptionJa), descriptionEn: s(p.descriptionEn),
    lat: p.lat, lng: p.lng, positionVerified: p.positionVerified, positionSource: s(p.positionSource), radiusM: p.radiusM,
    status: p.status, statusNoteJa: s(p.statusNoteJa), statusNoteEn: s(p.statusNoteEn),
    permissionConfirmed: p.permissionConfirmed, permissionNote: s(p.permissionNote),
  };
}

export function draftFromServer(route: AdminRoute, spots: AdminSpot[]): RouteDraft {
  const line: LngLatEle[] = route.geometry ? route.geometry.coordinates.map((c) => (c[2] === undefined ? [c[0], c[1]] : [c[0], c[1], c[2]])) : [];
  const eles = elevationsOf(line);
  return {
    id: route.id, updatedAt: route.updatedAt, nameJa: route.nameJa, nameEn: s(route.nameEn), descriptionJa: s(route.descriptionJa),
    descriptionEn: s(route.descriptionEn), prefecture: route.prefecture, municipality: s(route.municipality),
    distanceKm: route.distanceKm,
    // A saved distance that is not the line's own length was typed by hand: keep it when the line changes.
    distanceManual: route.distanceKm !== null && (line.length < 2 || route.distanceKm !== lengthKm(line)),
    elevationGainM: route.elevationGainM,
    climbManual: route.elevationGainM !== null && (!eles || route.elevationGainM !== climbM(eles)),
    expectedTimeMin: route.expectedTimeMin, difficulty: s(route.difficulty), videoUrl: s(route.videoUrl),
    line, lineVerified: route.lineVerified, lineSource: s(route.lineSource),
    places: spots.map(placeFromServer),
  };
}

export const newPlace = (key: string, lat: number, lng: number, n: number): PlaceDraft => ({
  key, id: null, updatedAt: null, published: false, nameJa: `場所${n}`, nameEn: "", descriptionJa: "", descriptionEn: "",
  lat, lng, positionVerified: false, positionSource: "", radiusM: 50, status: "open", statusNoteJa: "", statusNoteEn: "",
  permissionConfirmed: false, permissionNote: "",
});

// ---- the state and its actions -------------------------------------------------------------------------------

export interface DraftState {
  present: RouteDraft;
  past: RouteDraft[];
  future: RouteDraft[];
}

export const initialState = (draft: RouteDraft): DraftState => ({ present: draft, past: [], future: [] });

export type TextField = "nameJa" | "nameEn" | "descriptionJa" | "descriptionEn" | "municipality" | "difficulty" | "videoUrl" | "lineSource";

export type DraftAction =
  | { type: "text"; field: TextField; value: string }
  | { type: "prefecture"; value: Prefecture | null }
  | { type: "distance"; value: number | null }
  | { type: "climb"; value: number | null }
  | { type: "time"; value: number | null }
  | { type: "lineVerified"; value: boolean }
  | { type: "line"; points: LngLatEle[] }
  /** The same points with elevations filled in (from the map tiles): not an undo step, and the line stays as drawn. */
  | { type: "elevations"; points: LngLatEle[] }
  | { type: "addPlace"; key: string; lat: number; lng: number }
  | { type: "movePlace"; key: string; lat: number; lng: number }
  | { type: "place"; key: string; patch: Partial<PlaceDraft> }
  | { type: "removePlace"; key: string }
  | { type: "reorderPlaces"; keys: string[] }
  | { type: "undo" }
  | { type: "redo" }
  /** Start over from a saved copy (after loading or saving). */
  | { type: "loaded"; draft: RouteDraft }
  /** One place or the route itself was saved: take over what the server answered, without an undo step. */
  | { type: "savedPlace"; key: string; place: PlaceDraft }
  | { type: "savedRoute"; id: string; updatedAt: string };

const HISTORY = 100;

function withLine(d: RouteDraft, points: LngLatEle[]): RouteDraft {
  const next: RouteDraft = { ...d, line: points, lineVerified: false };
  if (!d.distanceManual) next.distanceKm = points.length >= 2 ? lengthKm(points) : null;
  const eles = elevationsOf(points);
  if (!d.climbManual) next.elevationGainM = eles ? climbM(eles) : d.elevationGainM;
  return next;
}

/** The actions that change the map or the order of places can be undone; typing is left to the browser's own undo. */
const undoable = new Set<DraftAction["type"]>(["line", "addPlace", "movePlace", "removePlace", "reorderPlaces"]);

function apply(d: RouteDraft, a: DraftAction): RouteDraft {
  switch (a.type) {
    case "text":
      return { ...d, [a.field]: a.value };
    case "prefecture":
      return { ...d, prefecture: a.value };
    case "distance":
      // Emptying the field hands the number back to the line.
      return a.value === null
        ? { ...d, distanceKm: d.line.length >= 2 ? lengthKm(d.line) : null, distanceManual: false }
        : { ...d, distanceKm: a.value, distanceManual: true };
    case "climb": {
      if (a.value !== null) return { ...d, elevationGainM: a.value, climbManual: true };
      const eles = elevationsOf(d.line);
      return { ...d, elevationGainM: eles ? climbM(eles) : null, climbManual: false };
    }
    case "time":
      return { ...d, expectedTimeMin: a.value };
    case "lineVerified":
      return { ...d, lineVerified: a.value };
    case "line":
      return withLine(d, a.points);
    case "elevations": {
      const same = a.points.length === d.line.length && a.points.every((p, i) => p[0] === d.line[i]![0] && p[1] === d.line[i]![1]);
      if (!same) return d; // the line moved on while the heights were being fetched: drop them
      const next: RouteDraft = { ...d, line: a.points };
      const eles = elevationsOf(a.points);
      if (!d.climbManual && eles) next.elevationGainM = climbM(eles);
      return next;
    }
    case "addPlace":
      return { ...d, places: [...d.places, newPlace(a.key, a.lat, a.lng, d.places.length + 1)] };
    case "movePlace":
      return { ...d, places: d.places.map((p) => (p.key === a.key ? { ...p, lat: a.lat, lng: a.lng, positionVerified: false } : p)) };
    case "place":
      return {
        ...d,
        places: d.places.map((p) => {
          if (p.key !== a.key) return p;
          const moved = (a.patch.lat !== undefined && a.patch.lat !== p.lat) || (a.patch.lng !== undefined && a.patch.lng !== p.lng);
          return { ...p, ...a.patch, ...(moved && a.patch.positionVerified === undefined ? { positionVerified: false } : {}) };
        }),
      };
    case "removePlace":
      return { ...d, places: d.places.filter((p) => p.key !== a.key) };
    case "reorderPlaces": {
      const byKey = new Map(d.places.map((p) => [p.key, p]));
      if (a.keys.length !== d.places.length || !a.keys.every((k) => byKey.has(k))) return d;
      return { ...d, places: a.keys.map((k) => byKey.get(k)!) };
    }
    case "savedPlace":
      return { ...d, places: d.places.map((p) => (p.key === a.key ? a.place : p)) };
    case "savedRoute":
      return { ...d, id: a.id, updatedAt: a.updatedAt };
    default:
      return d;
  }
}

export function draftReducer(state: DraftState, a: DraftAction): DraftState {
  if (a.type === "loaded") return initialState(a.draft);
  if (a.type === "undo") {
    const prev = state.past.at(-1);
    return prev ? { present: prev, past: state.past.slice(0, -1), future: [state.present, ...state.future] } : state;
  }
  if (a.type === "redo") {
    const next = state.future[0];
    return next ? { present: next, past: [...state.past, state.present], future: state.future.slice(1) } : state;
  }
  const present = apply(state.present, a);
  if (present === state.present) return state;
  if (!undoable.has(a.type)) return { ...state, present };
  return { present, past: [...state.past, state.present].slice(-HISTORY), future: [] };
}

export const isDirty = (draft: RouteDraft, saved: RouteDraft): boolean => JSON.stringify(draft) !== JSON.stringify(saved);

// ---- publish rules ------------------------------------------------------------------------------------------

export type PublishBlocker = "no_coordinates" | "position_not_verified" | "permission_required" | "unsaved";

/** What still stops a place from being published, in the order the API checks it (the API decides in the end). */
export function publishBlockers(p: PlaceDraft, dirty = false): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (p.id === null || dirty) out.push("unsaved");
  if (p.lat === null || p.lng === null) out.push("no_coordinates");
  else if (!p.positionVerified || !p.positionSource.trim()) out.push("position_not_verified");
  if (!p.permissionConfirmed) out.push("permission_required");
  return out;
}

// ---- the live preview ---------------------------------------------------------------------------------------

const nz = (v: string) => (v.trim() === "" ? null : v);

/** The draft as the public route page would show it (every place, checked or not: an admin is looking). */
export function previewRoute(d: RouteDraft, order: number): RouteDetail {
  const lats = d.line.map((p) => p[1]);
  const lngs = d.line.map((p) => p[0]);
  const bounds = d.line.length >= 2 ? { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) } : null;
  return {
    id: d.id ?? "new",
    order,
    status: d.places.some((p) => p.published) ? "ready" : "soon",
    nameJa: d.nameJa,
    nameEn: nz(d.nameEn),
    prefecture: d.prefecture,
    municipality: nz(d.municipality),
    distanceKm: d.distanceKm,
    elevationGainM: d.elevationGainM,
    difficulty: nz(d.difficulty),
    expectedTimeMin: d.expectedTimeMin,
    sketch: sketchFromPoints(d.line),
    area: areaFromBounds(bounds),
    spotCount: d.places.length,
    stampedCount: null,
    descriptionJa: nz(d.descriptionJa),
    descriptionEn: nz(d.descriptionEn),
    spots: d.places.map((p) => ({
      id: p.id ?? p.key,
      nameJa: p.nameJa,
      nameEn: nz(p.nameEn),
      status: p.status,
      stamped: null,
      position: p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng, verified: p.positionVerified } : null,
    })),
    line: d.line.length >= 2 ? d.line.map(([lng, lat]) => ({ lat, lng })) : null,
    videoUrl: nz(d.videoUrl),
    photoUrl: null,
  };
}

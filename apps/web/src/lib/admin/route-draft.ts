import type { GalleryPhoto, RouteDetail, RoutePoint } from "../content";
import { stampableByDefault, type PointKind } from "../point-kinds";
import { areaFromBounds, sketchFromPoints } from "../route-geometry";
import { climbM, descentM, elevationsOf, lengthKm, type LngLatEle } from "./line";
import { capLegs, joinLegs, legsFromJoined, pathStops, reconcileLegs, sidePairs, splitLine, type Leg } from "./legs";
import type { Translations } from "./content-locales";
import type { AccessPoint } from "../access-points";
import type { TechnicalLevel } from "../grading";
import { prefectureOfCity } from "@/lib/municipalities";
import type { AdminRoute, AdminSpot, Prefecture, SpotStatus, WalkStyle } from "./types";
import { timesFromPrevious } from "../leg-times";
import { estimateWalkMinutes } from "./walk-time";

// What the route editor holds while someone is typing and drawing: every field as the form shows it (text is "" when
// empty), the line as points, and the points of the route in order. Pure, so the rules are tested without a browser.
//
// A "place" here is a waypoint of the route (a temple, a turn, a toilet, a danger ...). One list holds them all, because
// they share the map and the same checks for a position; the `stampable` switch says whether visitors can stamp there.

export interface PlaceDraft {
  /** A client-side id, stable while the place is not saved yet (and equal to `id` once it is). */
  key: string;
  /** null until the place has been saved once. */
  id: string | null;
  updatedAt: string | null;
  published: boolean;
  kind: PointKind;
  /** Visitors can collect a stamp here: it needs the site's permission to publish and counts in rallies. */
  stampable: boolean;
  /** An optional visit beside the way (寄り道): the line of the route need not pass through it. */
  stopBy: boolean;
  nameJa: string;
  nameEn: string;
  /** How the Japanese name is read, typed by a person ("" = none). */
  nameKana: string;
  descriptionJa: string;
  descriptionEn: string;
  /** Its story: where the name comes from, what happened there. */
  historyJa: string;
  historyEn: string;
  /** The other content languages ({ de: { name } }). */
  translations: Translations;
  /** A picture used as this place's stamp (empty: the plain seal). */
  stampImageUrl: string;
  photoUrl: string;
  photoCredit: string;
  /** The page the main photo was found on (empty when it is our own). */
  photoSourceUrl: string;
  /** Where the words come from (出典). */
  sourceJa: string;
  sourceEn: string;
  /** More photos of the place, in order. */
  photos: GalleryPhoto[];
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
  historyJa: string;
  historyEn: string;
  accessJa: string;
  accessEn: string;
  /** The other content languages ({ de: { name } }). */
  translations: Translations;
  photoUrl: string;
  photoCredit: string;
  sourceJa: string;
  sourceEn: string;
  prefecture: Prefecture | null;
  walkStyle: WalkStyle | null;
  /** The cities the course runs through, in walking order. */
  municipalities: string[];
  distanceKm: number | null;
  /** True once someone typed a distance: drawing no longer overwrites it. */
  distanceManual: boolean;
  elevationGainM: number | null;
  climbManual: boolean;
  expectedTimeMin: number | null;
  /** True once someone typed a walking time: it no longer follows the distance and climb. */
  timeManual: boolean;
  difficulty: string;
  /** How the Japanese name is read (furigana shown over it); "" when not set. */
  nameKana: string;
  /** How to get there: kind, place and note for each way (see lib/access-points.ts). */
  accessPoints: AccessPoint[];
  /** The mountain-grading levels (see lib/grading.ts); null until chosen. */
  physicalLevel: number | null;
  /** Metres from the course that count as far (the app shows train and bus instead of a walk); null = the default. */
  farDistanceM: number | null;
  /** The box drawn for the course on the overview map; null = the automatic box around its line. */
  area: { west: number; south: number; east: number; north: number } | null;
  technicalLevel: TechnicalLevel | null;
  videoUrl: string;
  /** The English video's link (empty: the English site shows the Japanese video). */
  videoUrlEn: string;
  /** Subtitles were uploaded for the English video. */
  videoSubtitlesEn: boolean;
  /** Subtitles were uploaded for the video. */
  videoSubtitles: boolean;
  /** The whole line: the legs joined in order. Only a track imported before there are two stops to cut it at is held here alone. */
  line: LngLatEle[];
  /** The line cut into one leg for each pair of stops; redrawing a leg leaves the others alone (see legs.ts). */
  legs: Leg[];
  lineVerified: boolean;
  lineSource: string;
  places: PlaceDraft[];
}

export const emptyDraft = (): RouteDraft => ({
  id: null, updatedAt: null, nameJa: "", nameEn: "", descriptionJa: "", descriptionEn: "", historyJa: "", historyEn: "",
  accessJa: "", accessEn: "", translations: {}, photoUrl: "", photoCredit: "", sourceJa: "", sourceEn: "", prefecture: null, walkStyle: null, municipalities: [],
  distanceKm: null, distanceManual: false, elevationGainM: null, climbManual: false, expectedTimeMin: null, timeManual: false,
  difficulty: "", nameKana: "", accessPoints: [], farDistanceM: null, area: null, physicalLevel: null, technicalLevel: null, videoUrl: "", videoUrlEn: "", videoSubtitlesEn: false, videoSubtitles: false, line: [], legs: [], lineVerified: false, lineSource: "", places: [],
});

const s = (v: string | null | undefined) => v ?? "";

export function placeFromServer(p: AdminSpot): PlaceDraft {
  return {
    key: p.id, id: p.id, updatedAt: p.updatedAt, published: p.published, kind: p.kind, stampable: p.stampable, stopBy: p.stopBy,
    nameJa: p.nameJa, nameEn: s(p.nameEn), nameKana: s(p.nameKana), descriptionJa: s(p.descriptionJa), descriptionEn: s(p.descriptionEn), historyJa: s(p.historyJa), historyEn: s(p.historyEn), translations: p.translations ?? {}, stampImageUrl: s(p.stampImageUrl), photoUrl: s(p.photoUrl), photoCredit: s(p.photoCredit), photoSourceUrl: s(p.photoSourceUrl), sourceJa: s(p.sourceJa), sourceEn: s(p.sourceEn), photos: p.photos ?? [],
    lat: p.lat, lng: p.lng, positionVerified: p.positionVerified, positionSource: s(p.positionSource), radiusM: p.radiusM,
    status: p.status, statusNoteJa: s(p.statusNoteJa), statusNoteEn: s(p.statusNoteEn),
    permissionConfirmed: p.permissionConfirmed, permissionNote: s(p.permissionNote),
  };
}

/**
 * The legs of a saved route: the ones it was saved with, or (a line that was drawn in one piece) the line cut at the stops.
 * Cut here, not saved: the route is saved with legs the next time its line changes.
 */
function legsFromServer(route: AdminRoute, places: PlaceDraft[], line: LngLatEle[]): Leg[] {
  const stops = pathStops(places);
  // A leg keeps what the editor put on it: a side trip, a ride (ferry, bus ...) and its guide points.
  const saved: Leg[] = (route.geometry?.legs ?? []).map((l) => ({
    from: l.from,
    to: l.to,
    points: l.coordinates.map((c): LngLatEle => (c[2] === undefined ? [c[0], c[1]] : [c[0], c[1], c[2]])),
    ...(l.side ? { side: true as const } : {}),
    ...(l.back ? { back: true as const } : {}),
    ...(l.ride ? { ride: l.ride } : {}),
    ...(l.via && l.via.length > 0 ? { via: l.via } : {}),
  }));
  const kept = reconcileLegs(stops, saved, sidePairs(places));
  return kept.length > 0 ? kept : splitLine(stops, line);
}

export function draftFromServer(route: AdminRoute, spots: AdminSpot[]): RouteDraft {
  const places = spots.map(placeFromServer);
  const line: LngLatEle[] = route.geometry ? route.geometry.coordinates.map((c) => (c[2] === undefined ? [c[0], c[1]] : [c[0], c[1], c[2]])) : [];
  const legs = legsFromServer(route, places, line);
  const eles = elevationsOf(line);
  return {
    id: route.id, updatedAt: route.updatedAt, nameJa: route.nameJa, nameEn: s(route.nameEn), descriptionJa: s(route.descriptionJa),
    descriptionEn: s(route.descriptionEn), historyJa: s(route.historyJa), historyEn: s(route.historyEn),
    accessJa: s(route.accessJa), accessEn: s(route.accessEn), translations: route.translations ?? {}, photoUrl: s(route.photoUrl),
    photoCredit: s(route.photoCredit), sourceJa: s(route.sourceJa), sourceEn: s(route.sourceEn),
    prefecture: route.prefecture, walkStyle: route.walkStyle, municipalities: [...route.municipalities],
    distanceKm: route.distanceKm,
    // A saved distance that is not the line's own length was typed by hand: keep it when the line changes.
    distanceManual: route.distanceKm !== null && (line.length < 2 || route.distanceKm !== walkedStats(line, legs).km),
    elevationGainM: route.elevationGainM,
    climbManual: route.elevationGainM !== null && (!eles || route.elevationGainM !== walkedStats(line, legs).climb),
    expectedTimeMin: route.expectedTimeMin,
    // A saved time that is not what the distance and climb give was typed by hand.
    timeManual: route.expectedTimeMin !== null && route.expectedTimeMin !== estimateWalkMinutes(route.distanceKm, route.elevationGainM),
    difficulty: s(route.difficulty), nameKana: s(route.nameKana), accessPoints: route.accessPoints ?? [], farDistanceM: route.farDistanceM ?? null, area: route.area ?? null, physicalLevel: route.physicalLevel, technicalLevel: route.technicalLevel, videoUrl: s(route.videoUrl), videoUrlEn: s(route.videoUrlEn), videoSubtitlesEn: route.videoSubtitlesEn === true, videoSubtitles: route.videoSubtitles === true,
    line: legs.length > 0 ? joinLegs(pathStops(places), legs).line : line, legs, lineVerified: route.lineVerified, lineSource: s(route.lineSource),
    places,
  };
}

export const newPlace = (key: string, lat: number | null, lng: number | null, n: number, kind: PointKind = "other"): PlaceDraft => ({
  key, id: null, updatedAt: null, published: false, kind, stampable: stampableByDefault(kind), stopBy: false,
  nameJa: stampableByDefault(kind) ? `経由地${n}` : "", nameEn: "", nameKana: "", descriptionJa: "", descriptionEn: "", historyJa: "", historyEn: "",
  translations: {}, stampImageUrl: "", photoUrl: "", photoCredit: "", photoSourceUrl: "", sourceJa: "", sourceEn: "", photos: [], lat, lng, positionVerified: false, positionSource: "", radiusM: 50, status: "open", statusNoteJa: "", statusNoteEn: "",
  permissionConfirmed: false, permissionNote: "",
});

/** The waypoints with a stamp, in order (the numbers on the map and in the public list). */
export const stampPlaces = (d: Pick<RouteDraft, "places">): PlaceDraft[] => d.places.filter((p) => p.stampable);
/** The waypoints without a stamp (turns, toilets ...), in order. */
export const navigationPoints = (d: Pick<RouteDraft, "places">): PlaceDraft[] => d.places.filter((p) => !p.stampable);

// ---- the state and its actions -------------------------------------------------------------------------------

export interface DraftState {
  present: RouteDraft;
  past: RouteDraft[];
  future: RouteDraft[];
}

export const initialState = (draft: RouteDraft): DraftState => ({ present: draft, past: [], future: [] });

export type TextField =
  | "nameJa"
  | "nameEn"
  | "descriptionJa"
  | "descriptionEn"
  | "historyJa"
  | "historyEn"
  | "accessJa"
  | "accessEn"
  | "photoUrl"
  | "photoCredit"
  | "sourceJa"
  | "sourceEn"
  | "difficulty"
  | "nameKana"
  | "videoUrl"
  | "videoUrlEn"
  | "lineSource";

export type DraftAction =
  | { type: "text"; field: TextField; value: string }
  /** The route's words in the other content languages. */
  | { type: "translations"; value: Translations }
  | { type: "accessPoints"; value: AccessPoint[] }
  /** The cities the course runs through, in walking order. */
  | { type: "municipalities"; value: string[] }
  | { type: "walkStyle"; value: WalkStyle | null }
  | { type: "physicalLevel"; value: number | null }
  | { type: "farDistanceM"; value: number | null }
  | { type: "area"; value: { west: number; south: number; east: number; north: number } | null }
  | { type: "technicalLevel"; value: TechnicalLevel | null }
  | { type: "distance"; value: number | null }
  | { type: "climb"; value: number | null }
  | { type: "time"; value: number | null }
  | { type: "lineVerified"; value: boolean }
  | { type: "videoSubtitles"; value: boolean }
  | { type: "videoSubtitlesEn"; value: boolean }
  /** A whole line (an imported track): cut into legs at the stops when there are two or more. */
  | { type: "line"; points: LngLatEle[] }
  /** One leg drawn, found on trails or made straight; it replaces that pair's leg and no other. */
  | { type: "setLeg"; leg: Leg }
  /** Several legs at once (one undo step). */
  | { type: "setLegs"; legs: Leg[] }
  | { type: "clearLeg"; from: string; to: string }
  /** The whole line and every leg. */
  | { type: "clearLegs" }
  /** Cut the loose line into legs at the stops even though the stops do not follow it. */
  | { type: "splitLine" }
  /** The same points with elevations filled in (from the map tiles): not an undo step, and the line stays as drawn. */
  | { type: "elevations"; points: LngLatEle[] }
  /** `patch` is applied to the new waypoint (one undo step), for example a copy that is not a stamp place. */
  | { type: "addPlace"; key: string; lat: number; lng: number; kind?: PointKind; patch?: Partial<PlaceDraft>; /** Put it right after this waypoint instead of at the end. */ after?: string }
  /** Several places at once (named points of a GPX file): one undo step, all drafts. */
  | { type: "addPlaces"; places: { key: string; name: string; lat: number; lng: number }[] }
  /** An empty row in the places table: a stamp place with no name and no position yet (typed in the row). */
  | { type: "addRow"; key: string }
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

/**
 * The distance and climb of the part that is walked. A leg that is ridden (a ferry across the water) is left out: its time is
 * what the editor typed, not a walking estimate. Without ridden legs this is the whole line.
 */
export function walkedStats(line: readonly LngLatEle[], legs: readonly Leg[]): { km: number | null; climb: number | null; descent: number | null } {
  if (!legs.some((l) => l.ride && !l.side)) {
    const eles = elevationsOf([...line]);
    return { km: line.length >= 2 ? lengthKm(line) : null, climb: eles ? climbM(eles) : null, descent: eles ? descentM(eles) : null };
  }
  const walked = legs.filter((l) => !l.ride && !l.side);
  const km = Math.round(walked.reduce((n, l) => n + lengthKm(l.points), 0) * 100) / 100;
  const climbs = walked.map((l) => elevationsOf(l.points));
  const all = walked.map((l) => elevationsOf(l.points));
  return {
    km: km > 0 ? km : null,
    climb: climbs.every((c) => c !== null) ? climbs.reduce((n, c) => n + climbM(c!), 0) : null,
    descent: all.every((c) => c !== null) ? all.reduce((n, c) => n + descentM(c!), 0) : null,
  };
}

function withLine(d: RouteDraft, points: LngLatEle[], legs: readonly Leg[] = d.legs): RouteDraft {
  const next: RouteDraft = { ...d, line: points, lineVerified: false };
  const walked = walkedStats(points, legs);
  if (!d.distanceManual) next.distanceKm = walked.km;
  if (!d.climbManual) next.elevationGainM = walked.climb ?? d.elevationGainM;
  return next;
}

/** The legs as the line: the legs are made to fit the stops, thinned to the point budget and joined. */
function withLegs(d: RouteDraft, legs: readonly Leg[]): RouteDraft {
  const stops = pathStops(d.places);
  const fitted = capLegs(reconcileLegs(stops, legs, sidePairs(d.places)));
  return { ...withLine(d, fitted.length > 0 ? joinLegs(stops, fitted).line : [], fitted), legs: fitted };
}

/**
 * After the places changed: the legs follow the stops (a moved stop drags its legs' ends, a removed one joins its neighbours'
 * legs). A track that was imported before there were two stops is cut as soon as there are.
 */
function syncLegs(d: RouteDraft): RouteDraft {
  const stops = pathStops(d.places);
  if (d.legs.length === 0) {
    if (d.line.length < 2 || stops.length < 2) return d;
    const cut = splitLine(stops, d.line); // none when the stops do not follow the line: it stays as it is
    return cut.length > 0 ? withLegs(d, cut) : d;
  }
  const fitted = reconcileLegs(stops, d.legs, sidePairs(d.places));
  return fitted === d.legs ? d : withLegs(d, fitted);
}

/** The actions that change the map or the order of places can be undone; typing is left to the browser's own undo. */
const undoable = new Set<DraftAction["type"]>(["area", "line", "splitLine", "setLeg", "setLegs", "clearLeg", "clearLegs", "addPlace", "addPlaces", "addRow", "movePlace", "removePlace", "reorderPlaces"]);

/** The walking time follows the distance and the climb until someone types one. */
const withAutoTime = (d: RouteDraft): RouteDraft => {
  if (d.timeManual) return d;
  const walk = estimateWalkMinutes(d.distanceKm, d.elevationGainM);
  // The minutes typed for the ridden legs (a ferry ...) are added to the walking estimate, not estimated.
  const ridden = d.legs.reduce((n, l) => n + (l.ride && !l.side ? l.ride.minutes : 0), 0);
  const t = ridden === 0 ? walk : (walk ?? 0) + ridden;
  return t === d.expectedTimeMin ? d : { ...d, expectedTimeMin: t };
};

/** The kinds that change the distance or the climb, and so the estimate of the time. */
const moves = new Set<DraftAction["type"]>(["distance", "climb", "line", "setLeg", "setLegs", "clearLeg", "clearLegs", "elevations", "time"]);

function apply(d: RouteDraft, a: DraftAction): RouteDraft {
  switch (a.type) {
    case "text":
      // Another video has no subtitles until they are uploaded for it.
      return { ...d, [a.field]: a.value, ...(a.field === "videoUrl" && a.value !== d.videoUrl ? { videoSubtitles: false } : {}), ...(a.field === "videoUrlEn" && a.value !== d.videoUrlEn ? { videoSubtitlesEn: false } : {}) };
    case "videoSubtitles":
      return { ...d, videoSubtitles: a.value };
    case "videoSubtitlesEn":
      return { ...d, videoSubtitlesEn: a.value };
    case "translations":
      return { ...d, translations: a.value };
    case "accessPoints":
      return { ...d, accessPoints: a.value };
    case "municipalities": {
      // The prefecture is not asked for: it is the first listed city's. Typed towns and an empty list leave it as it was.
      const first = a.value.map(prefectureOfCity).find((p) => p !== null);
      return { ...d, municipalities: a.value, prefecture: first ?? d.prefecture };
    }
    case "walkStyle":
      return { ...d, walkStyle: a.value };
    case "farDistanceM":
      return { ...d, farDistanceM: a.value };
    case "area":
      return { ...d, area: a.value };
    case "physicalLevel":
      return { ...d, physicalLevel: a.value };
    case "technicalLevel":
      return { ...d, technicalLevel: a.value };
    case "distance":
      // Emptying the field hands the number back to the line.
      return a.value === null
        ? { ...d, distanceKm: walkedStats(d.line, d.legs).km, distanceManual: false }
        : { ...d, distanceKm: a.value, distanceManual: true };
    case "climb": {
      if (a.value !== null) return { ...d, elevationGainM: a.value, climbManual: true };
      return { ...d, elevationGainM: walkedStats(d.line, d.legs).climb, climbManual: false };
    }
    case "time":
      // Emptying the field hands the number back to the estimate.
      return a.value === null ? { ...d, timeManual: false } : { ...d, expectedTimeMin: a.value, timeManual: true };
    case "lineVerified":
      return { ...d, lineVerified: a.value };
    case "line": {
      const stops = pathStops(d.places);
      if (stops.length < 2) return { ...withLine(d, a.points, []), legs: [] };
      const cut = splitLine(stops, a.points);
      // A new track replaces the route's own stretches; the side trips drawn by hand stay.
      return cut.length > 0 ? withLegs(d, [...cut, ...d.legs.filter((l) => l.side || l.back)]) : { ...withLine(d, a.points, []), legs: [] };
    }
    case "setLeg":
      return withLegs(d, [...d.legs.filter((l) => !(l.from === a.leg.from && l.to === a.leg.to)), a.leg]);
    case "setLegs":
      return withLegs(d, a.legs);
    case "clearLeg":
      return withLegs(d, d.legs.filter((l) => !(l.from === a.from && l.to === a.to)));
    case "clearLegs":
      return { ...withLine(d, [], []), legs: [] };
    case "splitLine": {
      if (d.legs.length > 0) return d;
      const cut = splitLine(pathStops(d.places), d.line, { force: true });
      return cut.length > 0 ? withLegs(d, cut) : d;
    }
    case "elevations": {
      const same = a.points.length === d.line.length && a.points.every((p, i) => p[0] === d.line[i]![0] && p[1] === d.line[i]![1]);
      if (!same) return d; // the line moved on while the heights were being fetched: drop them
      // The heights belong to the legs the line is made of (a line that is only held loose has no legs).
      const legs = d.legs.length > 0 ? legsFromJoined(pathStops(d.places), d.legs, a.points) : [];
      if (!legs) return d;
      const next: RouteDraft = { ...d, line: a.points, legs };
      const climb = walkedStats(a.points, legs).climb;
      if (!d.climbManual && climb !== null) next.elevationGainM = climb;
      return next;
    }
    case "addPlace": {
      const kind = a.kind ?? "other";
      const n = d.places.filter((p) => p.stampable).length + 1;
      const added = { ...newPlace(a.key, a.lat, a.lng, n, kind), ...a.patch };
      const at = a.after === undefined ? -1 : d.places.findIndex((p) => p.key === a.after);
      return syncLegs({ ...d, places: at < 0 ? [...d.places, added] : [...d.places.slice(0, at + 1), added, ...d.places.slice(at + 1)] });
    }
    case "addPlaces": {
      if (a.places.length === 0) return d;
      const start = d.places.filter((p) => p.stampable).length;
      const added = a.places.map((p, i) => ({ ...newPlace(p.key, p.lat, p.lng, start + i + 1), nameJa: p.name.trim() || `経由地${start + i + 1}` }));
      return syncLegs({ ...d, places: [...d.places, ...added] });
    }
    case "addRow":
      return { ...d, places: [...d.places, { ...newPlace(a.key, null, null, 0), nameJa: "" }] };
    case "movePlace":
      return syncLegs({ ...d, places: d.places.map((p) => (p.key === a.key ? { ...p, lat: a.lat, lng: a.lng, positionVerified: false, published: false } : p)) });
    case "place":
      return syncLegs({
        ...d,
        places: d.places.map((p) => {
          if (p.key !== a.key) return p;
          const moved = (a.patch.lat !== undefined && a.patch.lat !== p.lat) || (a.patch.lng !== undefined && a.patch.lng !== p.lng);
          // Any edit turns a published waypoint back into a draft (the editor asks first, and the save unpublishes it before changing it).
          const edited = Object.keys(a.patch).some((k) => k !== "published");
          return { ...p, ...a.patch, ...(moved && a.patch.positionVerified === undefined ? { positionVerified: false } : {}), ...(edited ? { published: false } : {}) };
        }),
      });
    case "removePlace":
      return syncLegs({ ...d, places: d.places.filter((p) => p.key !== a.key) });
    case "reorderPlaces": {
      const byKey = new Map(d.places.map((p) => [p.key, p]));
      if (a.keys.length !== d.places.length || !a.keys.every((k) => byKey.has(k))) return d;
      return syncLegs({ ...d, places: a.keys.map((k) => byKey.get(k)!) });
    }
    case "savedPlace":
      return { ...d, places: d.places.map((p) => (p.key === a.key ? a.place : p)) };
    case "savedRoute":
      return { ...d, id: a.id, updatedAt: a.updatedAt };
    default:
      return d;
  }
}

/** What a save settled for good: undo takes back the words and the map, never a thing's id or the time the server gave it. */
function keepServerIds(d: RouteDraft, a: Extract<DraftAction, { type: "savedPlace" | "savedRoute" }>): RouteDraft {
  if (a.type === "savedRoute") return { ...d, id: a.id, updatedAt: a.updatedAt };
  return { ...d, places: d.places.map((p) => (p.key === a.key ? { ...p, id: a.place.id, updatedAt: a.place.updatedAt } : p)) };
}

export function draftReducer(state: DraftState, a: DraftAction): DraftState {
  if (a.type === "loaded") return initialState(a.draft);
  if (a.type === "savedPlace" || a.type === "savedRoute") {
    return { present: apply(state.present, a), past: state.past.map((d) => keepServerIds(d, a)), future: state.future.map((d) => keepServerIds(d, a)) };
  }
  if (a.type === "undo") {
    const prev = state.past.at(-1);
    return prev ? { present: prev, past: state.past.slice(0, -1), future: [state.present, ...state.future] } : state;
  }
  if (a.type === "redo") {
    const next = state.future[0];
    return next ? { present: next, past: [...state.past, state.present], future: state.future.slice(1) } : state;
  }
  let present = apply(state.present, a);
  if (present === state.present) return state;
  // The walking time follows the distance and climb: when the line changed (also because a stop moved), not on other edits.
  if (moves.has(a.type) || present.line !== state.present.line) present = withAutoTime(present);
  if (!undoable.has(a.type)) return { ...state, present };
  return { present, past: [...state.past, state.present].slice(-HISTORY), future: [] };
}

export const isDirty = (draft: RouteDraft, saved: RouteDraft): boolean => JSON.stringify(draft) !== JSON.stringify(saved);

// ---- publish rules ------------------------------------------------------------------------------------------

export type PublishBlocker = "no_coordinates" | "position_not_verified" | "permission_required" | "unsaved";

/**
 * What still stops a place from being published, in the order the API checks it (the API decides in the end).
 * Every place needs the site's permission, with a stamp or without (each has its own page).
 */
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

const pointOf = (p: PlaceDraft, d: Pick<RouteDraft, "places">): RoutePoint => ({
  id: p.id ?? p.key,
  sortOrder: d.places.indexOf(p),
  photoUrl: nz(p.photoUrl),
  photoCredit: nz(p.photoCredit),
  ...(p.stopBy ? { stopBy: true } : {}),
  kind: p.kind,
  nameJa: p.nameJa,
  nameEn: nz(p.nameEn),
  descriptionJa: nz(p.descriptionJa),
  descriptionEn: nz(p.descriptionEn),
  position: p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng, verified: p.positionVerified } : null,
});

/** The draft as the public route page would show it (every place, checked or not: an admin is looking). */
export function previewRoute(d: RouteDraft, order: number): RouteDetail {
  const lats = d.line.map((p) => p[1]);
  const lngs = d.line.map((p) => p[0]);
  const bounds = d.line.length >= 2 ? { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) } : null;
  const stamps = stampPlaces(d);
  // The way back (return legs) doubles over earlier stops, so the time from each stop to the next is read from the route's own legs only.
  const outLine = d.legs.some((l) => l.back) ? joinLegs(pathStops(d.places), d.legs.filter((l) => !l.back)).line : d.line;
  const times = timesFromPrevious(stamps.map((p) => ({ id: p.id ?? p.key, position: p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null, stopBy: p.stopBy })), outLine, d.legs.flatMap((l) => (l.ride && !l.side && !l.back ? [{ spotId: l.to, ...l.ride }] : [])));
  return {
    id: d.id ?? "new",
    order,
    status: stamps.some((p) => p.published) ? "ready" : "soon",
    nameJa: d.nameJa,
    nameEn: nz(d.nameEn),
    prefecture: d.prefecture,
    walkStyle: d.walkStyle,
    municipalities: d.municipalities,
    distanceKm: d.distanceKm,
    elevationGainM: d.elevationGainM,
    difficulty: nz(d.difficulty),
    nameKana: nz(d.nameKana),
    accessPoints: d.accessPoints,
    physicalLevel: d.physicalLevel,
    technicalLevel: d.technicalLevel,
    expectedTimeMin: d.expectedTimeMin,
    farDistanceM: d.farDistanceM,
    sketch: sketchFromPoints(d.line),
    area: areaFromBounds(d.area ?? bounds),
    spotCount: stamps.length,
    stampedCount: null,
    descriptionJa: nz(d.descriptionJa),
    descriptionEn: nz(d.descriptionEn),
    historyJa: nz(d.historyJa),
    historyEn: nz(d.historyEn),
    accessJa: nz(d.accessJa),
    accessEn: nz(d.accessEn),
    sourceJa: nz(d.sourceJa),
    sourceEn: nz(d.sourceEn),
    spots: stamps.map((p) => ({
      id: p.id ?? p.key,
      nameJa: p.nameJa,
      nameEn: nz(p.nameEn),
      status: p.status,
      stamped: null,
      sortOrder: d.places.indexOf(p),
      stampable: true,
      descriptionJa: nz(p.descriptionJa),
      descriptionEn: nz(p.descriptionEn),
      photoUrl: nz(p.photoUrl),
      photoCredit: nz(p.photoCredit),
      ...(p.stopBy ? { stopBy: true } : {}),
      ...(times.get(p.id ?? p.key) ? { fromPrev: times.get(p.id ?? p.key) } : {}),
      position: p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng, verified: p.positionVerified } : null,
    })),
    points: navigationPoints(d).map((p) => pointOf(p, d)),
    line: d.line.length >= 2 ? d.line.map(([lng, lat]) => ({ lat, lng })) : null,
    sideLines: d.legs.filter((l) => l.side).map((l) => ({ spotId: l.to, line: l.points.map(([lng, lat]) => ({ lat, lng })) })),
    videoUrl: nz(d.videoUrl),
    videoUrlEn: nz(d.videoUrlEn),
    videoSubtitlesEn: d.videoSubtitlesEn,
    videoSubtitles: d.videoSubtitles,
    photoUrl: nz(d.photoUrl),
    photoCredit: nz(d.photoCredit),
  };
}

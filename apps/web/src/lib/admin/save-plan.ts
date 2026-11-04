import { translationsChange, type Translations } from "./content-locales";
import type { Ride } from "./legs";
import type { PlaceDraft, RouteDraft } from "./route-draft";
import type { GalleryPhoto } from "../content";
import { parseVideoFile } from "../video";
import type { PointKind } from "../point-kinds";
import type { Prefecture, SpotStatus, WalkStyle } from "./types";
import type { TechnicalLevel } from "../grading";
import type { AccessPoint } from "../access-points";

// Works out what has to be sent to the API to turn the saved copy of a route into the edited one: which fields, in what
// order. Pure, so the order of calls (and what is NOT sent) is tested. The editor runs the steps one by one and stops at
// the first failure, keeping the draft, so nothing is lost and nothing is sent twice.

const nullIfEmpty = (v: string): string | null => (v.trim() === "" ? null : v);

type Coordinates = [number, number, number?][];
/** The line as sent: the whole line, and the legs it is made of (their ends are waypoint keys here, ids once sent). */
export interface RouteLine {
  type: "LineString";
  coordinates: Coordinates;
  legs?: { from: string; to: string; coordinates: Coordinates; side?: true; ride?: Ride; via?: [number, number][] }[];
}

export interface RouteBody {
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  prefecture: Prefecture | null;
  walkStyle: WalkStyle | null;
  municipality: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  expectedTimeMin: number | null;
  difficulty: string | null;
  nameKana: string | null;
  accessPoints: AccessPoint[];
  physicalLevel: number | null;
  farDistanceM: number | null;
  technicalLevel: TechnicalLevel | null;
  videoUrl: string | null;
  videoUrlEn: string | null;
  videoSubtitlesEn: boolean;
  videoSubtitles: boolean;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  sourceJa: string | null;
  sourceEn: string | null;
  photoUrl: string | null;
  photoCredit: string | null;
  geometry: RouteLine | null;
  lineVerified: boolean;
  lineSource: string | null;
  translations: Translations;
}

export interface PlaceBody {
  kind: PointKind;
  stampable: boolean;
  stopBy: boolean;
  stampImageUrl: string | null;
  photoUrl: string | null;
  photoCredit: string | null;
  sourceJa: string | null;
  sourceEn: string | null;
  photos: GalleryPhoto[];
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  historyJa: string | null;
  historyEn: string | null;
  lat: number | null;
  lng: number | null;
  positionVerified: boolean;
  positionSource: string | null;
  radiusM: number;
  status: SpotStatus;
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  permissionConfirmed: boolean;
  permissionNote: string | null;
  translations: Translations;
}

const coordinate = (p: readonly (number | undefined)[]): [number, number, number?] => (p[2] === undefined ? [p[0]!, p[1]!] : [p[0]!, p[1]!, p[2]]);

/**
 * The body with the legs' ends turned from waypoint keys into waypoint ids (what the API knows). A leg whose waypoint has no
 * id yet is left out; the plan saves the line again once the waypoints exist.
 */
export function withLegIds<B extends { geometry?: RouteLine | null }>(body: B, ids: ReadonlyMap<string, string | null>): B {
  const geometry = body.geometry;
  if (!geometry?.legs) return body;
  const legs = geometry.legs.flatMap((l) => {
    const [from, to] = [ids.get(l.from), ids.get(l.to)];
    return from && to ? [{ ...l, from, to }] : [];
  });
  const plain = { type: geometry.type, coordinates: geometry.coordinates };
  return { ...body, geometry: legs.length > 0 ? { ...plain, legs } : plain };
}

export function routeBody(d: RouteDraft): RouteBody {
  return {
    nameJa: d.nameJa.trim(),
    nameEn: nullIfEmpty(d.nameEn),
    descriptionJa: nullIfEmpty(d.descriptionJa),
    descriptionEn: nullIfEmpty(d.descriptionEn),
    prefecture: d.prefecture,
    walkStyle: d.walkStyle,
    municipality: nullIfEmpty(d.municipality),
    distanceKm: d.distanceKm,
    elevationGainM: d.elevationGainM,
    expectedTimeMin: d.expectedTimeMin,
    difficulty: nullIfEmpty(d.difficulty),
    nameKana: nullIfEmpty(d.nameKana),
    accessPoints: d.accessPoints,
    physicalLevel: d.physicalLevel,
    farDistanceM: d.farDistanceM,
    technicalLevel: d.technicalLevel,
    videoUrl: nullIfEmpty(d.videoUrl),
    videoUrlEn: nullIfEmpty(d.videoUrlEn),
    videoSubtitlesEn: d.videoSubtitlesEn,
    videoSubtitles: d.videoSubtitles,
    historyJa: nullIfEmpty(d.historyJa),
    historyEn: nullIfEmpty(d.historyEn),
    accessJa: nullIfEmpty(d.accessJa),
    accessEn: nullIfEmpty(d.accessEn),
    sourceJa: nullIfEmpty(d.sourceJa),
    sourceEn: nullIfEmpty(d.sourceEn),
    photoUrl: nullIfEmpty(d.photoUrl),
    photoCredit: nullIfEmpty(d.photoCredit),
    geometry: d.line.length >= 2 ? { type: "LineString", coordinates: d.line.map(coordinate), ...(d.legs.length > 0 ? { legs: d.legs.map((l) => ({ from: l.from, to: l.to, coordinates: l.points.map(coordinate), ...(l.side ? { side: true as const } : {}), ...(l.ride ? { ride: l.ride } : {}), ...(l.via && l.via.length > 0 ? { via: l.via } : {}) })) } : {}) } : null,
    // "Checked" needs a named source (the server refuses it otherwise): without one the line is saved as not checked yet.
    lineVerified: d.lineVerified && d.lineSource.trim() !== "",
    lineSource: nullIfEmpty(d.lineSource),
    translations: d.translations,
  };
}

export function placeBody(p: PlaceDraft): PlaceBody {
  return {
    kind: p.kind,
    stampable: p.stampable,
    stopBy: p.stopBy,
    stampImageUrl: nullIfEmpty(p.stampImageUrl),
    photoUrl: nullIfEmpty(p.photoUrl),
    photoCredit: nullIfEmpty(p.photoCredit),
    sourceJa: nullIfEmpty(p.sourceJa),
    sourceEn: nullIfEmpty(p.sourceEn),
    photos: p.photos.filter((x) => x.url.trim() !== ""),
    nameJa: p.nameJa.trim(),
    nameEn: nullIfEmpty(p.nameEn),
    descriptionJa: nullIfEmpty(p.descriptionJa),
    descriptionEn: nullIfEmpty(p.descriptionEn),
    historyJa: nullIfEmpty(p.historyJa),
    historyEn: nullIfEmpty(p.historyEn),
    lat: p.lat,
    lng: p.lng,
    positionVerified: p.positionVerified,
    positionSource: nullIfEmpty(p.positionSource),
    radiusM: p.radiusM,
    status: p.status,
    statusNoteJa: nullIfEmpty(p.statusNoteJa),
    statusNoteEn: nullIfEmpty(p.statusNoteEn),
    permissionConfirmed: p.permissionConfirmed,
    permissionNote: nullIfEmpty(p.permissionNote),
    translations: p.translations,
  };
}

/** Whether a place has changes that are not saved (or was never saved). */
export const placeChanged = (p: PlaceDraft, saved: PlaceDraft | undefined): boolean =>
  !saved || p.id === null || Object.keys(changed(placeBody(p), placeBody(saved))).length > 0;

/**
 * The keys whose value differs, by value. The other languages are compared by meaning (blank = none) and only
 * what changed in them is sent (null clears).
 */
function changed<T extends { translations: Translations }>(next: T, saved: T | null): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(next) as (keyof T)[]) {
    if (k === "translations") continue;
    if (saved === null || JSON.stringify(next[k]) !== JSON.stringify(saved[k])) out[k] = next[k];
  }
  const words = saved === null ? next.translations : translationsChange(saved.translations, next.translations);
  if (words && Object.keys(words).length > 0) out.translations = words;
  return out;
}

export type SaveStep =
  | { op: "deleteSpot"; key: string; id: string }
  /** A published waypoint that was edited: taken off the site before its changes are saved. */
  | { op: "unpublishSpot"; key: string; id: string }
  | { op: "createRoute"; body: RouteBody }
  | { op: "updateRoute"; body: Partial<RouteBody> }
  | { op: "createSpot"; key: string; body: PlaceBody }
  | { op: "updateSpot"; key: string; id: string; body: Partial<PlaceBody> }
  /** Put the places in the draft's order (the keys of the places, which the editor maps to ids). */
  | { op: "orderSpots"; keys: string[] };

/** Everything that differs between the saved copy and the edited one, in the order it must be sent. */
export function planSave(draft: RouteDraft, saved: RouteDraft | null): SaveStep[] {
  const steps: SaveStep[] = [];
  const savedPlaces = new Map((saved?.places ?? []).map((p) => [p.key, p]));
  const draftKeys = new Set(draft.places.map((p) => p.key));

  // 1. Places taken out go first, so a deleted place never blocks anything below.
  for (const p of saved?.places ?? []) if (!draftKeys.has(p.key) && p.id) steps.push({ op: "deleteSpot", key: p.key, id: p.id });

  // 1b. A published waypoint that was edited is a draft in the editor: it comes off the site before its changes are saved.
  for (const p of draft.places) if (p.id && savedPlaces.get(p.key)?.published && !p.published) steps.push({ op: "unpublishSpot", key: p.key, id: p.id });

  // 2. The route itself. The legs name their waypoints by id, so when one of them is new the line is saved after the waypoints are.
  const unsaved = new Set(draft.places.filter((p) => p.id === null).map((p) => p.key));
  const lateLine = draft.legs.some((l) => unsaved.has(l.from) || unsaved.has(l.to));
  let after: Partial<RouteBody> | null = null;
  if (draft.id === null) {
    steps.push({ op: "createRoute", body: routeBody(draft) });
    if (lateLine) after = { geometry: routeBody(draft).geometry, lineVerified: routeBody(draft).lineVerified, lineSource: nullIfEmpty(draft.lineSource) };
  } else {
    const diff = changed(routeBody(draft), saved ? routeBody(saved) : null);
    // Redrawing the line cancels its check on the server; never send the line without saying what its check is.
    if ("geometry" in diff) {
      diff.lineVerified = routeBody(draft).lineVerified;
      diff.lineSource = routeBody(draft).lineSource;
      if (lateLine) {
        after = { geometry: diff.geometry, lineVerified: diff.lineVerified, lineSource: diff.lineSource };
        delete diff.geometry;
        delete diff.lineVerified;
        delete diff.lineSource;
      }
    }
    if (Object.keys(diff).length > 0) steps.push({ op: "updateRoute", body: diff });
  }

  // 3. New and changed places.
  for (const p of draft.places) {
    const before = savedPlaces.get(p.key) ?? null;
    if (p.id === null || before === null) {
      steps.push({ op: "createSpot", key: p.key, body: placeBody(p) });
      continue;
    }
    const diff = changed(placeBody(p), placeBody(before));
    // A position is both numbers, and moving it needs its check restated.
    if ("lat" in diff || "lng" in diff) {
      const full = placeBody(p);
      diff.lat = full.lat;
      diff.lng = full.lng;
      diff.positionVerified = full.positionVerified;
      diff.positionSource = full.positionSource;
    }
    if (Object.keys(diff).length > 0) steps.push({ op: "updateSpot", key: p.key, id: p.id, body: diff });
  }

  if (after) steps.push({ op: "updateRoute", body: after });

  // 4. Order: what the server will hold after the steps above (kept places in their saved order, new ones after).
  const expected = [
    ...(saved?.places ?? []).filter((p) => draftKeys.has(p.key)).map((p) => p.key),
    ...draft.places.filter((p) => !savedPlaces.has(p.key)).map((p) => p.key),
  ];
  const wanted = draft.places.map((p) => p.key);
  if (wanted.length > 1 && expected.join("\n") !== wanted.join("\n")) steps.push({ op: "orderSpots", keys: wanted });
  return steps;
}

/**
 * After a save that held some waypoints back: what the server now holds, with the held waypoints put back where they were in the
 * edited draft, as typed (a saved one with the server's update time, so its next save is not refused). The server's waypoints
 * come in the order they were sent, which is the draft's order without the held new ones.
 */
export function restoreHeld(fromServer: RouteDraft, edited: RouteDraft, held: ReadonlySet<string>): RouteDraft {
  if (held.size === 0) return fromServer;
  let at = 0;
  return {
    ...fromServer,
    places: edited.places.flatMap((p) => {
      if (!held.has(p.key)) return fromServer.places[at] ? [fromServer.places[at++]!] : [];
      if (p.id === null) return [p];
      const own = fromServer.places[at++];
      return [{ ...p, updatedAt: own?.updatedAt ?? p.updatedAt }];
    }),
  };
}

/**
 * After a save, the screen is replaced by what the server now holds. A change made on the screen while the save was running
 * (a video that finished uploading, subtitles added) would be lost and the Save button would stay dark: this puts the route's
 * own fields that changed since the save began back on top. Waypoints and the line are not merged (they are saved in the steps).
 */
export function keepLaterEdits(fromServer: RouteDraft, atStart: RouteDraft, now: RouteDraft): RouteDraft {
  const out: Record<string, unknown> = { ...fromServer };
  for (const key of Object.keys(now) as (keyof RouteDraft)[]) {
    if (key === "id" || key === "updatedAt" || key === "places" || key === "legs" || key === "line") continue;
    if (JSON.stringify(now[key]) !== JSON.stringify(atStart[key])) out[key] = now[key];
  }
  return out as unknown as RouteDraft;
}

// ---- checks before saving ------------------------------------------------------------------------------------

export type DraftProblem =
  | { kind: "route_name" }
  | { kind: "place_name"; key: string }
  | { kind: "place_position"; key: string }
  | { kind: "video_link" }
  | { kind: "video_link_en" }
  | { kind: "photo_link" }
  | { kind: "place_photo_link"; key: string };

/** Whether a typed photo address could be accepted: empty, or an https link (the API makes the final decision). */
export function photoLinkLooksValid(raw: string): boolean {
  if (raw.trim() === "") return true;
  if (raw.trim().length > 500) return false;
  try {
    return new URL(raw.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

const VIDEO_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "player.vimeo.com"];

/** Whether a typed video address could be accepted (the API makes the final decision). Empty is fine. */
export function videoLinkLooksValid(raw: string): boolean {
  if (raw.trim() === "") return true;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && (VIDEO_HOSTS.includes(u.hostname.toLowerCase()) || parseVideoFile(raw) !== null);
  } catch {
    return false;
  }
}

/** What would be refused anyway, found before sending. */
export function draftProblems(d: RouteDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (d.nameJa.trim() === "") out.push({ kind: "route_name" });
  if (!videoLinkLooksValid(d.videoUrl)) out.push({ kind: "video_link" });
  if (!videoLinkLooksValid(d.videoUrlEn)) out.push({ kind: "video_link_en" });
  if (!photoLinkLooksValid(d.photoUrl)) out.push({ kind: "photo_link" });
  for (const p of d.places) {
    if (p.nameJa.trim() === "") out.push({ kind: "place_name", key: p.key });
    if (!photoLinkLooksValid(p.photoUrl)) out.push({ kind: "place_photo_link", key: p.key });
    // A position is both numbers or neither; the app never fills in the missing one.
    if ((p.lat === null) !== (p.lng === null)) out.push({ kind: "place_position", key: p.key });
  }
  return out;
}

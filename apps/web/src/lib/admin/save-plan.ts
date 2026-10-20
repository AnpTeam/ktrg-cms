import { translationsChange, type Translations } from "./content-locales";
import type { PlaceDraft, RouteDraft } from "./route-draft";
import type { PointKind } from "../point-kinds";
import type { Prefecture, SpotStatus } from "./types";

// Works out what has to be sent to the API to turn the saved copy of a route into the edited one: which fields, in what
// order. Pure, so the order of calls (and what is NOT sent) is tested. The editor runs the steps one by one and stops at
// the first failure, keeping the draft, so nothing is lost and nothing is sent twice.

const nullIfEmpty = (v: string): string | null => (v.trim() === "" ? null : v);

export interface RouteBody {
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  prefecture: Prefecture | null;
  municipality: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  expectedTimeMin: number | null;
  difficulty: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  photoUrl: string | null;
  geometry: { type: "LineString"; coordinates: [number, number, number?][] } | null;
  lineVerified: boolean;
  lineSource: string | null;
  translations: Translations;
}

export interface PlaceBody {
  kind: PointKind;
  stampable: boolean;
  stopBy: boolean;
  photoUrl: string | null;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
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

export function routeBody(d: RouteDraft): RouteBody {
  return {
    nameJa: d.nameJa.trim(),
    nameEn: nullIfEmpty(d.nameEn),
    descriptionJa: nullIfEmpty(d.descriptionJa),
    descriptionEn: nullIfEmpty(d.descriptionEn),
    prefecture: d.prefecture,
    municipality: nullIfEmpty(d.municipality),
    distanceKm: d.distanceKm,
    elevationGainM: d.elevationGainM,
    expectedTimeMin: d.expectedTimeMin,
    difficulty: nullIfEmpty(d.difficulty),
    videoUrl: nullIfEmpty(d.videoUrl),
    historyJa: nullIfEmpty(d.historyJa),
    historyEn: nullIfEmpty(d.historyEn),
    accessJa: nullIfEmpty(d.accessJa),
    accessEn: nullIfEmpty(d.accessEn),
    photoUrl: nullIfEmpty(d.photoUrl),
    geometry: d.line.length >= 2 ? { type: "LineString", coordinates: d.line.map((p) => (p[2] === undefined ? [p[0], p[1]] : [p[0], p[1], p[2]])) } : null,
    lineVerified: d.lineVerified,
    lineSource: nullIfEmpty(d.lineSource),
    translations: d.translations,
  };
}

export function placeBody(p: PlaceDraft): PlaceBody {
  return {
    kind: p.kind,
    stampable: p.stampable,
    stopBy: p.stopBy,
    photoUrl: nullIfEmpty(p.photoUrl),
    nameJa: p.nameJa.trim(),
    nameEn: nullIfEmpty(p.nameEn),
    descriptionJa: nullIfEmpty(p.descriptionJa),
    descriptionEn: nullIfEmpty(p.descriptionEn),
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

  // 2. The route itself.
  if (draft.id === null) steps.push({ op: "createRoute", body: routeBody(draft) });
  else {
    const diff = changed(routeBody(draft), saved ? routeBody(saved) : null);
    // Redrawing the line cancels its check on the server; never send the line without saying what its check is.
    if ("geometry" in diff) {
      diff.lineVerified = routeBody(draft).lineVerified;
      diff.lineSource = routeBody(draft).lineSource;
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

  // 4. Order: what the server will hold after the steps above (kept places in their saved order, new ones after).
  const expected = [
    ...(saved?.places ?? []).filter((p) => draftKeys.has(p.key)).map((p) => p.key),
    ...draft.places.filter((p) => !savedPlaces.has(p.key)).map((p) => p.key),
  ];
  const wanted = draft.places.map((p) => p.key);
  if (wanted.length > 1 && expected.join("\n") !== wanted.join("\n")) steps.push({ op: "orderSpots", keys: wanted });
  return steps;
}

// ---- checks before saving ------------------------------------------------------------------------------------

export type DraftProblem =
  | { kind: "route_name" }
  | { kind: "place_name"; key: string }
  | { kind: "place_position"; key: string }
  | { kind: "video_link" }
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
    return u.protocol === "https:" && VIDEO_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** What would be refused anyway, found before sending. */
export function draftProblems(d: RouteDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (d.nameJa.trim() === "") out.push({ kind: "route_name" });
  if (!videoLinkLooksValid(d.videoUrl)) out.push({ kind: "video_link" });
  if (!photoLinkLooksValid(d.photoUrl)) out.push({ kind: "photo_link" });
  for (const p of d.places) {
    if (p.nameJa.trim() === "") out.push({ kind: "place_name", key: p.key });
    if (!photoLinkLooksValid(p.photoUrl)) out.push({ kind: "place_photo_link", key: p.key });
    // A position is both numbers or neither; the app never fills in the missing one.
    if ((p.lat === null) !== (p.lng === null)) out.push({ kind: "place_position", key: p.key });
  }
  return out;
}

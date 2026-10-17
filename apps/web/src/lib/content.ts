import type { RouteArea } from "./map-screen";
import type { MapPlace, PlaceCategory, PlaceStatus } from "./places";
import type { RallyItem } from "./rally-model";
import { sampleLastStamped, sampleMounds, sampleMoundsStamped } from "./sample-mounds";
import { samplePlaces } from "./sample-places";
import { sampleRoutes, sampleSpots } from "./sample-content";
import type { Sketch } from "./sketch";
import type { Viewer } from "./viewer";

// View-models for the public content screens (WBS 3.2.3, 3.2.4, 3.2.5). Each field
// mirrors a CMS column in apps/api/src/db/schema/content.ts, so what an editor types
// in the admin (3.4.x) is exactly what appears here. Japanese is required; English is
// optional and falls back to Japanese.
//
// TODO(WBS 2.2.1, 2.2.2): replace the bodies of the three functions below with Eden
// calls to GET /routes, /routes/{id} and /spots/{id}, and take these types from the
// API response instead of declaring them here. The API should send `sketch` already
// simplified (at most about 40 points), never the full GeoJSON line, and should say
// whether routes without published spots are listed as "soon" (decide with 2.2.1).

export const prefectures = ["osaka", "wakayama", "nara"] as const;
export type Prefecture = (typeof prefectures)[number];

export type SpotStatus = "open" | "caution" | "closed";

export interface RouteSummary {
  id: string;
  /** Position on the trail, 1 to 19, from Tomogashima to Kamenose. */
  order: number;
  /** "soon" = no published spots yet: shown as 準備中. */
  status: "ready" | "soon";
  nameJa: string;
  nameEn: string | null;
  prefecture: Prefecture | null;
  municipality: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: string | null;
  expectedTimeMin: number | null;
  /** A simplified route line for the list silhouette, when the CMS has geometry. */
  sketch: Sketch | null;
  /** Where the course is, as one round area on the home map; null until the CMS has it. */
  area: RouteArea | null;
  spotCount: number;
  /** Stamps this visitor holds on the route; null when not signed in. */
  stampedCount: number | null;
}

/** Where a stop is. `verified` is false for draft positions (for example clicked on Navivi's map). */
export interface SpotPosition {
  lat: number;
  lng: number;
  verified: boolean;
}

export interface SpotListItem {
  id: string;
  nameJa: string;
  nameEn: string | null;
  status: SpotStatus;
  /** null when not signed in. */
  stamped: boolean | null;
  /** null when the CMS has no coordinates yet; the API returns them only for published spots. */
  position: SpotPosition | null;
}

export interface RouteDetail extends RouteSummary {
  descriptionJa: string | null;
  descriptionEn: string | null;
  spots: SpotListItem[];
  /** The path to draw on the map, in order; null until the CMS has the track (then the map joins the stops). */
  line: { lat: number; lng: number }[] | null;
  /** The guidance video's address (the CMS `video_url`); only YouTube and Vimeo links are shown (`parseVideoUrl`). */
  videoUrl: string | null;
}

export interface SpotDetail extends SpotListItem {
  routeId: string;
  routeNameJa: string;
  routeNameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  /** ISO timestamp of the last status change. */
  statusUpdatedAt: string | null;
}

export interface Picked {
  text: string;
  lang: "ja" | "en";
  /** English was requested but only Japanese exists. */
  fallback: boolean;
}

/** The text for a locale: English if asked and entered, otherwise Japanese. */
export function pickText(locale: string, ja: string | null, en: string | null): Picked | null {
  if (locale === "en" && en) return { text: en, lang: "en", fallback: false };
  if (ja) return { text: ja, lang: "ja", fallback: locale === "en" };
  return null;
}

export function isPrefecture(value: string | undefined): value is Prefecture {
  return prefectures.some((p) => p === value);
}

export function filterByPrefecture<T extends { prefecture: Prefecture | null }>(
  routes: T[],
  prefecture: Prefecture | undefined,
) {
  return prefecture ? routes.filter((r) => r.prefecture === prefecture) : routes;
}

/** Sections by prefecture only when every route has one; otherwise one plain ribbon. */
export function canGroupByPrefecture(routes: { prefecture: Prefecture | null }[]) {
  return routes.length > 0 && routes.every((r) => r.prefecture !== null);
}

/** Remove everything personal for a signed-out visitor: progress counts and stamp state. */
export function forViewer<T extends { stampedCount?: number | null; stamped?: boolean | null; spots?: SpotListItem[] }>(
  item: T,
  viewer: Viewer,
): T {
  if (viewer.signedIn) return item;
  const out = { ...item };
  if ("stampedCount" in out) out.stampedCount = null;
  if ("stamped" in out) out.stamped = null;
  if (out.spots) out.spots = out.spots.map((s) => ({ ...s, stamped: null }));
  return out;
}

/**
 * Sample content is for design review only. It is on by default in development (set
 * SHOW_SAMPLE_CONTENT=0 to see the real empty state) and off everywhere else unless
 * SHOW_SAMPLE_CONTENT=1 (for example a preview deployment),
 * and every screen that shows it says so (see SampleNotice).
 */
export function sampleContentEnabled(env: { NODE_ENV?: string; SHOW_SAMPLE_CONTENT?: string } = process.env) {
  if (env.SHOW_SAMPLE_CONTENT === "1") return true;
  if (env.SHOW_SAMPLE_CONTENT === "0") return false;
  return env.NODE_ENV === "development"; // on by default only while developing
}

// What GET /routes will return per route: no description, no spot list.
function toSummary(r: RouteDetail): RouteSummary {
  return {
    id: r.id,
    order: r.order,
    status: r.status,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    prefecture: r.prefecture,
    municipality: r.municipality,
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    difficulty: r.difficulty,
    expectedTimeMin: r.expectedTimeMin,
    sketch: r.sketch,
    area: r.area,
    spotCount: r.spotCount,
    stampedCount: r.stampedCount,
  };
}

/** A place along the courses as the CMS holds it (Japanese required, English optional). */
export interface PlaceItem {
  id: string;
  category: PlaceCategory;
  nameJa: string;
  nameEn: string | null;
  /** The course numbers (1 to 19) this place serves. */
  routes: number[];
  position: { lat: number; lng: number; verified: boolean };
  hoursJa: string | null;
  hoursEn: string | null;
  closedDaysJa: string | null;
  closedDaysEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  status: PlaceStatus;
  /** YYYY-MM-DD of the last check by a person; null when never. */
  lastVerified: string | null;
}

/** The places that serve a course. Only sample data for now (the places API does not exist yet). */
export async function listPlacesForRoute(order: number): Promise<PlaceItem[]> {
  return sampleContentEnabled() ? samplePlaces.filter((p) => p.routes.includes(order)) : [];
}

/** A place with its text chosen for the visitor's language (English falls back to Japanese). */
export function toMapPlace(locale: string, p: PlaceItem): MapPlace {
  const name = pickText(locale, p.nameJa, p.nameEn);
  return {
    id: p.id,
    category: p.category,
    name: name?.text ?? p.nameJa,
    nameLang: name?.lang ?? "ja",
    hours: pickText(locale, p.hoursJa, p.hoursEn)?.text ?? null,
    closedDays: pickText(locale, p.closedDaysJa, p.closedDaysEn)?.text ?? null,
    description: pickText(locale, p.descriptionJa, p.descriptionEn)?.text ?? null,
    status: p.status,
    position: { lat: p.position.lat, lng: p.position.lng },
    verified: p.position.verified,
    lastVerified: p.lastVerified,
  };
}

/**
 * Every stamp rally: the 31 sutra mound places as one rally, then one rally per course (a course
 * with no published places has none to show and is 準備中). Only sample data for now (the
 * rallies API does not exist yet); the personal parts are removed for a signed-out visitor by
 * forRallyViewer.
 */
export async function listRallies(): Promise<RallyItem[]> {
  if (!sampleContentEnabled()) return [];
  const moundSlots = sampleMounds.map((m) => ({
    id: `sample-m${m.number}`,
    number: m.number,
    nameJa: m.nameJa,
    nameEn: m.nameEn,
    stamped: sampleMoundsStamped.has(m.number),
  }));
  const mounds: RallyItem = {
    id: "mounds",
    kind: "mounds",
    order: 0,
    nameJa: "経塚スタンプラリー",
    nameEn: "Sutra mound stamp rally",
    routeId: null,
    total: moundSlots.length,
    stamped: moundSlots.filter((s) => s.stamped).length,
    lastStampedAt: sampleLastStamped.mounds ?? null,
    slots: moundSlots,
  };
  const courses = sampleRoutes.map((r): RallyItem => {
    const slots = r.spots.map((s, i) => ({ id: s.id, number: i + 1, nameJa: s.nameJa, nameEn: s.nameEn, stamped: s.stamped === true }));
    return {
      id: `course-${r.order}`,
      kind: "course",
      order: r.order,
      nameJa: r.nameJa,
      nameEn: r.nameEn,
      routeId: r.id,
      total: slots.length,
      stamped: slots.filter((s) => s.stamped).length,
      lastStampedAt: sampleLastStamped[r.id] ?? null,
      slots,
    };
  });
  return [mounds, ...courses];
}

export async function listRoutes(): Promise<RouteSummary[]> {
  return sampleContentEnabled() ? sampleRoutes.map(toSummary) : [];
}

export async function getRoute(id: string): Promise<RouteDetail | undefined> {
  return sampleContentEnabled() ? sampleRoutes.find((r) => r.id === id) : undefined;
}

export async function getSpot(id: string): Promise<SpotDetail | undefined> {
  return sampleContentEnabled() ? sampleSpots.find((s) => s.id === id) : undefined;
}

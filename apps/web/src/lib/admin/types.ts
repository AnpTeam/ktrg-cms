import type { Translations } from "./content-locales";
// What the admin API sends (apps/api/src/content/admin-routes.ts). Times are ISO text; `updatedAt` goes back with
// every save so the API can tell when someone else saved first.

import type { GalleryPhoto } from "../content";
import type { PointKind } from "../point-kinds";
import type { WalkStyle } from "../walk-style";
import type { TechnicalLevel } from "../grading";
import type { AccessPoint } from "../access-points";

export type Prefecture = "osaka" | "wakayama" | "nara";
export type { PointKind, WalkStyle };
export type SpotStatus = "open" | "caution" | "closed";

export interface AdminLine {
  type: "LineString";
  coordinates: [number, number, number?][];
  /** The route cut into the stretches between waypoints (ids of the waypoints), when it was drawn that way. */
  legs?: { from: string; to: string; coordinates: [number, number, number?][]; side?: true; ride?: { mode: "ferry" | "bus" | "train" | "other"; minutes: number }; via?: [number, number][] }[];
}

export interface AdminRoute {
  id: string;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: string | null;
  nameKana: string | null;
  accessPoints?: AccessPoint[];
  physicalLevel: number | null;
  technicalLevel: TechnicalLevel | null;
  expectedTimeMin: number | null;
  prefecture: Prefecture | null;
  walkStyle: WalkStyle | null;
  municipality: string | null;
  geometry: AdminLine | null;
  lineVerified: boolean;
  lineSource: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  /** Where the words come from (出典); may hold links. */
  sourceJa?: string | null;
  sourceEn?: string | null;
  photoUrl: string | null;
  /** Who took the photo / where it is from, shown with it; may hold links. */
  photoCredit?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** The other content languages ({ de: { name } }). */
  translations: Translations;
}

export interface AdminRouteSummary extends AdminRoute {
  /** Stamp places; the route's other points are in pointCount. */
  spotCount: number;
  publishedSpotCount: number;
  pointCount: number;
}

export interface AdminSpot {
  id: string;
  routeId: string;
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
  kind: PointKind;
  /** Visitors can collect a stamp here. */
  stampable: boolean;
  /** An optional visit beside the way (寄り道): the route's line need not pass through it. */
  stopBy: boolean;
  photoUrl: string | null;
  photoCredit?: string | null;
  sourceJa?: string | null;
  sourceEn?: string | null;
  /** More photos of the place, in order. */
  photos: GalleryPhoto[];
  status: SpotStatus;
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  statusUpdatedAt: string | null;
  sortOrder: number;
  published: boolean;
  permissionConfirmed: boolean;
  permissionNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** The other content languages ({ de: { name } }). */
  translations: Translations;
}

/** How a rally is made, chosen when it is created: a list of stamp places, or a list of courses. */
export type AdminRallyKind = "places" | "course";

/** A rally as the admin API sends it (apps/api/src/rallies/rally-admin-routes.ts). */
export interface AdminRally {
  id: string;
  kind: AdminRallyKind;
  nameJa: string;
  nameEn: string | null;
  /** The name in the other content languages ({ de: { name } }). */
  translations: Translations;
  sortOrder: number;
  published: boolean;
  /** Places (a rally of places) or courses (a rally of courses) in it. */
  memberCount: number;
  /** Visitors who have finished it. */
  completionCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A stamp place that is, or could be, in a rally of places. */
export interface AdminRallyPlace {
  spotId: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  published: boolean;
}

/** A course that is, or could be, in a rally of courses. */
export interface AdminRallyCourse {
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  stampPlaceCount: number;
  publishedStampPlaceCount: number;
}

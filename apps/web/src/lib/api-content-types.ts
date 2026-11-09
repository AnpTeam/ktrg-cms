// What the API sends for GET /routes, /routes/{id} and /spots/{id} (see apps/api/src/content/content-service.ts).
// Declared here by hand because Eden types the JSON dates as Date; the times arrive as ISO text.

import type { TechnicalLevel } from "./grading";
import type { AccessPoint } from "./access-points";

export interface PublicRoute {
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
  farDistanceM?: number | null;
  prefecture: string | null;
  walkStyle?: string | null;
  municipality: string | null;
  videoUrl: string | null;
  /** When the video was last put there or replaced (ISO); null for none. */
  videoUpdatedAt?: string | null;
  /** The video has subtitles beside it. */
  videoSubtitles?: boolean;
  /** The English-language video, shown instead of `videoUrl` on the English site. */
  videoUrlEn?: string | null;
  /** The English video has subtitles beside it. */
  videoSubtitlesEn?: boolean;
  /** When the route was last saved (ISO). */
  updatedAt?: string;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  sourceJa?: string | null;
  sourceEn?: string | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  sortOrder: number;
  status: "ready" | "soon";
  publishedSpotCount: number;
  sketch: [number, number][] | null;
  line: { type: "LineString"; coordinates: [number, number, number?][] } | null;
  /** Side trips (寄り道) to published places; in the detail only. */
  sideLines?: { spotId: string; coordinates: [number, number, number?][] }[];
  /** Stretches that are ridden (ferry, bus ...) with their minutes, by the place they lead to; in the detail only. */
  rides?: { spotId: string; mode: "ferry" | "bus" | "train" | "other"; minutes: number }[];
  bounds: { west: number; south: number; east: number; north: number } | null;
}

/** One published rally as GET /rallies sends it: a rally of places lists its places, a rally of courses its courses. */
export interface PublicRally {
  id: string;
  kind: "places" | "course";
  nameJa: string;
  nameEn: string | null;
  sortOrder: number;
  places: { id: string; routeId: string; nameJa: string; nameEn: string | null }[];
  /** Each course with its published stamp places and their status. */
  courses: { routeId: string; nameJa: string; nameEn: string | null; spots: { id: string; status: string }[] }[];
}

/** One rally as GET /rallies/:id sends it, for the rally's own page: every stamp place with its checked position. */
export interface PublicRallyDetail {
  id: string;
  kind: "places" | "course";
  nameJa: string;
  nameEn: string | null;
  /** ISO time the rally was last changed. */
  updatedAt: string;
  photoUrl: string | null;
  photoCredit: string | null;
  /** The stamp places, in order (for a rally of courses: those of every course). lat and lng are null until a person has checked the position. */
  places: { id: string; routeId: string; nameJa: string; nameEn: string | null; status: "open" | "caution" | "closed"; radiusM: number; lat: number | null; lng: number | null }[];
  courses: { routeId: string; nameJa: string; nameEn: string | null }[];
}

export interface PublicSpot {
  id: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  nameKana?: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  historyJa?: string | null;
  historyEn?: string | null;
  position: { lat: number; lng: number; verified: true } | null;
  radiusM: number;
  kind: string;
  /** A stamp can be collected here. */
  stampable: boolean;
  /** An optional visit beside the way (寄り道). */
  stopBy?: boolean;
  stampImageUrl?: string | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  sourceJa?: string | null;
  sourceEn?: string | null;
  photos?: { url: string; credit: string | null; sourceUrl: string | null }[];
  status: "open" | "caution" | "closed";
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  statusUpdatedAt: string | null;
  sortOrder: number;
  /** When the place was last saved (ISO). */
  updatedAt?: string;
}

/** One place of the directory as GET /places sends it (only published ones with a checked position). */
export interface PublicPlace {
  id: string;
  category: string;
  routeId: string | null;
  /** The waypoint it is closest to. */
  nearSpotId?: string | null;
  nameJa: string;
  nameEn: string | null;
  /** How the Japanese name is read, typed by a person. */
  nameKana?: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  hoursJa: string | null;
  hoursEn: string | null;
  closedDaysJa: string | null;
  closedDaysEn: string | null;
  lat: number;
  lng: number;
  addressJa: string | null;
  addressEn: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  status: string;
  lastVerified: string | null;
}

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
  prefecture: string | null;
  walkStyle?: string | null;
  municipality: string | null;
  videoUrl: string | null;
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

export interface PublicSpot {
  id: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
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
}

/** One place of the directory as GET /places sends it (only published ones with a checked position). */
export interface PublicPlace {
  id: string;
  category: string;
  routeId: string | null;
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  hoursJa: string | null;
  hoursEn: string | null;
  closedDaysJa: string | null;
  closedDaysEn: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  status: string;
  lastVerified: string | null;
}

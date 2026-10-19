// What the admin API sends (apps/api/src/content/admin-routes.ts). Times are ISO text; `updatedAt` goes back with
// every save so the API can tell when someone else saved first.

import type { PointKind } from "../point-kinds";

export type Prefecture = "osaka" | "wakayama" | "nara";
export type { PointKind };
export type SpotStatus = "open" | "caution" | "closed";

export interface AdminLine {
  type: "LineString";
  coordinates: [number, number, number?][];
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
  expectedTimeMin: number | null;
  prefecture: Prefecture | null;
  municipality: string | null;
  geometry: AdminLine | null;
  lineVerified: boolean;
  lineSource: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  photoUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
  lat: number | null;
  lng: number | null;
  positionVerified: boolean;
  positionSource: string | null;
  radiusM: number;
  kind: PointKind;
  photoUrl: string | null;
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
}

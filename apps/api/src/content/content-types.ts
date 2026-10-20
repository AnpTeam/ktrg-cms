import type { ErrorCode } from "../lib/api-errors";
import type { spotKinds } from "../db/schema/content";
import type { ROUTE_TEXT, SPOT_TEXT, Translations } from "../db/translations";
import type { LineString } from "./line";

/** A route's and a place's words in the other content languages (admin entry; visitors see ja / en). */
export type RouteTranslations = Translations<(typeof ROUTE_TEXT)[number]>;
export type SpotTranslations = Translations<(typeof SPOT_TEXT)[number]>;

export type SpotKind = (typeof spotKinds)[number];

export type Prefecture = "osaka" | "wakayama" | "nara";
export type SpotStatus = "open" | "caution" | "closed";

/** A route as the admin sees it. */
export interface RouteRow {
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
  geometry: LineString | null;
  /** True once a person has checked the line against an official source (lineSource). Visitors see the line only then. */
  lineVerified: boolean;
  lineSource: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  translations: RouteTranslations;
  photoUrl: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteSummaryRow extends RouteRow {
  /** Waypoints with a stamp (the others are counted apart in pointCount). */
  spotCount: number;
  publishedSpotCount: number;
  pointCount: number;
}

/** A waypoint of a route as the admin sees it (a stamp can be collected there when `stampable`). */
export interface SpotRow {
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
  /** What the waypoint is (see spotKinds). */
  kind: SpotKind;
  /** Visitors can collect a stamp here. */
  stampable: boolean;
  photoUrl: string | null;
  status: SpotStatus;
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  translations: SpotTranslations;
  statusUpdatedAt: Date | null;
  sortOrder: number;
  published: boolean;
  permissionConfirmed: boolean;
  permissionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What can be set when a route is made or changed. Every field is optional on change. */
export interface RouteFields {
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
  /** An unchecked line from the request; the service validates it. null removes the line. */
  geometry: unknown;
  lineVerified: boolean;
  lineSource: string | null;
  videoUrl: string | null;
  historyJa: string | null;
  historyEn: string | null;
  accessJa: string | null;
  accessEn: string | null;
  translations: RouteTranslations;
  photoUrl: string | null;
}

export interface SpotFields {
  nameJa: string;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  lat: number | null;
  lng: number | null;
  positionVerified: boolean;
  positionSource: string | null;
  radiusM: number;
  kind: SpotKind;
  stampable: boolean;
  photoUrl: string | null;
  status: SpotStatus;
  statusNoteJa: string | null;
  statusNoteEn: string | null;
  translations: SpotTranslations;
  permissionConfirmed: boolean;
  permissionNote: string | null;
}

/** What the store keeps: the route line is already checked and simplified. */
export type StoredRouteFields = Omit<RouteFields, "geometry"> & { geometry: LineString | null };

export type Result<T> = { ok: true; value: T } | { ok: false; reason: ErrorCode };

/**
 * Storage for routes and places. Every change takes the acting admin and writes its audit row
 * itself (in the same transaction for the database), so a change and its record cannot part.
 */
export interface ContentStore {
  listRoutes(): Promise<RouteSummaryRow[]>;
  getRoute(id: string): Promise<{ route: RouteRow; spots: SpotRow[] } | null>;
  getSpot(id: string): Promise<SpotRow | null>;

  createRoute(actor: string, fields: Partial<StoredRouteFields> & { nameJa: string }): Promise<RouteRow>;
  /** `expected` is the updatedAt the editor loaded: a different value means someone saved first. */
  updateRoute(actor: string, id: string, expected: Date, changes: Partial<StoredRouteFields>): Promise<RouteRow | "conflict" | null>;
  reorderRoutes(actor: string, ids: string[]): Promise<boolean>;
  deleteRoute(actor: string, id: string): Promise<"ok" | "has_places" | "not_found">;

  /** Also adds the place to its route's course rally (never to the mound rally). */
  createSpot(actor: string, routeId: string, fields: Partial<SpotFields> & { nameJa: string }): Promise<SpotRow | null>;
  updateSpot(actor: string, id: string, expected: Date, changes: Partial<SpotFields>): Promise<SpotRow | "conflict" | "has_stamps" | null>;
  setPublished(actor: string, id: string, published: boolean): Promise<SpotRow | null>;
  deleteSpot(actor: string, id: string): Promise<"ok" | "has_stamps" | "not_found">;
  reorderSpots(actor: string, routeId: string, ids: string[]): Promise<boolean>;
}

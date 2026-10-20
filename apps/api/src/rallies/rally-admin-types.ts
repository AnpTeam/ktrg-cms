// The admin side of rallies (the user's model, 2026-10-19). When an admin creates a rally they choose how it is made,
// and it stays that way: a rally of PLACES (a list of stamp places, such as the sutra-mound rally) or a rally of
// COURSES (a list of courses; a course is finished when all its stamp places are stamped). Visitors' stamps and
// finishes are never touched here.

import type { RALLY_TEXT, Translations } from "../db/translations";

export type RallyKind = "places" | "course";

/** A rally's name in the other content languages (admin entry; visitors see ja / en). */
export type RallyTranslations = Translations<(typeof RALLY_TEXT)[number]>;

/** A rally as the admin sees it. */
export interface RallyRow {
  id: string;
  kind: RallyKind;
  nameJa: string;
  nameEn: string | null;
  translations: RallyTranslations;
  sortOrder: number;
  published: boolean;
  /** Places (a rally of places) or courses (a rally of courses) in it. */
  memberCount: number;
  /** Visitors who have finished it. */
  completionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A stamp place that is, or could be, in a rally of places. */
export interface RallyPlace {
  spotId: string;
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  published: boolean;
}

/** A course that is, or could be, in a rally of courses. */
export interface RallyCourse {
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  /** Its stamp places, and how many of them are published (a course with none can never be finished). */
  stampPlaceCount: number;
  publishedStampPlaceCount: number;
}

export type RallyDetail =
  | { rally: RallyRow & { kind: "places" }; places: (RallyPlace & { position: number })[] }
  | { rally: RallyRow & { kind: "course" }; courses: (RallyCourse & { position: number })[] };

/** What an admin may change after creating a rally (the kind never changes). */
export interface RallyFields {
  nameJa: string;
  nameEn: string | null;
  translations: RallyTranslations;
  published: boolean;
}

/**
 * Storage for the rally admin. Every change takes the acting admin and writes its audit rows itself (in the same
 * transaction for the database). A change carries the `updatedAt` the editor loaded: a different value is a conflict.
 */
export interface RallyAdminStore {
  listRallies(): Promise<RallyRow[]>;
  getRally(id: string): Promise<RallyDetail | null>;
  /** Every stamp place, in trail order: what a rally of places may hold. */
  candidatePlaces(): Promise<RallyPlace[]>;
  /** Every course, in trail order: what a rally of courses may hold. */
  candidateCourses(): Promise<RallyCourse[]>;
  /**
   * A new rally, as a draft at the end of the order, with its first members (place ids for a rally of places, course
   * ids for a rally of courses) inserted together in one statement. The caller has checked they are allowed.
   */
  createRally(actor: string, fields: { kind: RallyKind; nameJa: string; nameEn: string | null; translations?: RallyTranslations; memberIds: string[] }): Promise<RallyRow>;
  updateRally(actor: string, id: string, expected: Date, changes: Partial<RallyFields>): Promise<RallyRow | "conflict" | null>;
  /** All rally ids, in the new order. */
  reorderRallies(actor: string, ids: string[]): Promise<boolean>;
  /** Replaces the places of a rally of places, in this order. The caller has checked they are allowed. */
  setPlaces(actor: string, id: string, expected: Date, spotIds: string[]): Promise<RallyRow | "conflict" | null>;
  /** Replaces the courses of a rally of courses, in this order. The caller has checked they are allowed. */
  setCourses(actor: string, id: string, expected: Date, routeIds: string[]): Promise<RallyRow | "conflict" | null>;
  /** Its links and visitors' finishes of it go too; stamps and course finishes stay. */
  deleteRally(actor: string, id: string): Promise<"ok" | "not_found">;
}

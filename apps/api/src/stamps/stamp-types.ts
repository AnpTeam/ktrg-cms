import type { ListRow } from "../admin-lists/list-types";

export type SpotStatus = "open" | "caution" | "closed" | "info";

/** What the stamping rules need to know about a place. */
export interface StampSpot {
  id: string;
  routeId: string;
  published: boolean;
  stampable: boolean;
  positionVerified: boolean;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  status: SpotStatus;
  /** When the status last changed: an offline stamp pressed before a closure is still accepted. */
  statusUpdatedAt?: Date | null;
}

/** Courses and rallies a stamp has just completed. */
export interface Finished {
  routeIds: string[];
  rallyIds: string[];
}

export interface Awarded {
  /** False when the visitor already held a stamp here: nothing was written. */
  created: boolean;
  createdAt: Date;
  flagged: boolean;
  /** The stamp held here was revoked by an admin: it blocks a new one and is hidden from the visitor's list. */
  revoked: boolean;
  finished: Finished;
}

/**
 * A stamp as the admin list shows it. Stamps are never typed in by hand: they appear when a visitor stamps near a
 * place, so the admin only reads them and revokes or restores one. Member ID and place name, no email or user id.
 * A stamp never changes except by revoking, so `updatedAt` is its creation time.
 */
export interface StampListRow extends ListRow {
  memberId: string;
  spotName: string;
  flagged: boolean;
  flagReason: string | null;
  revoked: boolean;
}

export interface StampStore {
  findSpot(id: string): Promise<StampSpot | null>;
  /** Several places in one query (a guest's whole cookie); an id that is not there is left out. */
  findSpots(ids: string[]): Promise<StampSpot[]>;
  /** Saves many stamps for one visitor at once (a guest signing up), each with the time it was earned: one transaction, finishes worked out once at the end. */
  awardMany(userId: string, items: { spotId: string; flagged: boolean; createdAt: Date }[]): Promise<{ added: number; already: number }>;
  /** Saves the stamp (one per visitor and place) and, in the same transaction, the courses and rallies it finishes. */
  award(userId: string, spotId: string, flag: { flagged: boolean; flagReason: string | null; scannedAt?: Date | null }): Promise<Awarded>;
  /** The visitor's own stamps that are not revoked. */
  listMine(userId: string): Promise<{ spotId: string; routeId: string; createdAt: Date }[]>;
  /** When the visitor finished each rally (saved at the moment the last stamp was awarded). */
  listCompletions(userId: string): Promise<{ rallyId: string; completedAt: Date }[]>;
  /** Revokes or restores; the audit row commits with it. Doing it again changes nothing and writes no audit row. */
  setRevoked(actor: string, id: string, revoked: boolean): Promise<"ok" | "not_found">;
}

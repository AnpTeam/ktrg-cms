export type SpotStatus = "open" | "caution" | "closed";

/** What the stamping rules need to know about a place. */
export interface StampSpot {
  id: string;
  published: boolean;
  stampable: boolean;
  positionVerified: boolean;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  status: SpotStatus;
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

/** A stamp in the admin review list: ids and the reason only, nothing personal. */
export interface ReviewStamp {
  id: string;
  userId: string;
  spotId: string;
  flagReason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface StampStore {
  findSpot(id: string): Promise<StampSpot | null>;
  /** Saves the stamp (one per visitor and place) and, in the same transaction, the courses and rallies it finishes. */
  award(userId: string, spotId: string, flag: { flagged: boolean; flagReason: string | null }): Promise<Awarded>;
  /** The visitor's own stamps that are not revoked. */
  listMine(userId: string): Promise<{ spotId: string; createdAt: Date }[]>;
  /** Flagged stamps, newest first: waiting for review, or (`revoked`) already revoked. At most `REVIEW_PAGE`. */
  listFlagged(revoked: boolean): Promise<ReviewStamp[]>;
  /** Revokes or restores; the audit row commits with it. Doing it twice is fine. */
  setRevoked(actor: string, id: string, revoked: boolean): Promise<"ok" | "not_found">;
}

// shortcut: the review list is one page of 50 with no cursor, upgrade when more than 50 stamps wait for review.
export const REVIEW_PAGE = 50;

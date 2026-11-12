import type { Result } from "../content/content-types";
import { distanceMeters } from "../lib/geo";
import type { Finished, StampSpot, StampStore } from "./stamp-types";

/** A reading worse than this is refused; from FLAG_ACCURACY_M up it is accepted but flagged for review. */
export const MAX_ACCURACY_M = 100;
export const FLAG_ACCURACY_M = 50;

export interface Reading {
  spotId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  /** ISO time the phone pressed the stamp, sent only when it was queued offline. Checked, not trusted. */
  scannedAt?: string;
}

/** A queued stamp may be this old when it is uploaded, and no more than this far ahead of the server's clock. */
export const MAX_SCAN_AGE_MS = 48 * 60 * 60 * 1000;
export const MAX_SCAN_AHEAD_MS = 5 * 60 * 1000;

export interface Collected {
  spotId: string;
  createdAt: Date;
  flagged: boolean;
  alreadyStamped: boolean;
  finished: Finished;
}

/**
 * The stamping rules. The server decides: the phone only reports where it is. The reading is used for the checks
 * and then dropped (a stamp stores no coordinates, and nothing here logs them).
 */
/** A place a visitor can head for and stamp: published, a stamp place, with a checked position. */
type StampPlace = StampSpot & { lat: number; lng: number };

// A draft, a navigation point and a place without a checked position all look like a place that is not there.
const isStampPlace = (spot: StampSpot | null): spot is StampPlace =>
  !!spot && spot.published && spot.stampable && spot.status !== "info" && spot.positionVerified && spot.lat !== null && spot.lng !== null;

/** The place checks of a stamp (open, close enough, accurate enough), shared by an account's stamp and a guest's. */
async function check(r: Reading, store: StampStore, now: Date): Promise<Result<{ spot: StampPlace; flagged: boolean; scannedAt: Date | null }>> {
  const spot = await store.findSpot(r.spotId);
  if (!isStampPlace(spot)) return { ok: false, reason: "not_found" };
  let scannedAt: Date | null = null;
  if (r.scannedAt !== undefined) {
    scannedAt = new Date(r.scannedAt);
    if (Number.isNaN(scannedAt.getTime()) || scannedAt.getTime() > now.getTime() + MAX_SCAN_AHEAD_MS) return { ok: false, reason: "bad_time" };
    if (scannedAt.getTime() < now.getTime() - MAX_SCAN_AGE_MS) return { ok: false, reason: "stale_scan" };
  }
  // Closed now: refused, unless the phone pressed the stamp before the closure was set (it was open when they stood there).
  if (spot.status === "closed" && !(scannedAt && spot.statusUpdatedAt && scannedAt < spot.statusUpdatedAt)) return { ok: false, reason: "spot_closed" };
  if (r.accuracyM > MAX_ACCURACY_M) return { ok: false, reason: "gps_accuracy_poor" };
  if (distanceMeters({ lat: r.lat, lng: r.lng }, { lat: spot.lat, lng: spot.lng }) > spot.radiusM) {
    return { ok: false, reason: "too_far" };
  }
  return { ok: true, value: { spot, flagged: r.accuracyM >= FLAG_ACCURACY_M, scannedAt } };
}

export function createStampService({ store, now = () => new Date() }: { store: StampStore; now?: () => Date }) {
  return {
    /** The place, if visitors may head for it and stamp it (also used by navigation); null otherwise. */
    async stampPlace(spotId: string): Promise<StampPlace | null> {
      const spot = await store.findSpot(spotId);
      return isStampPlace(spot) ? spot : null;
    },

    /** The stamp places among these ids, in one query; an id that is not (or no longer) a stamp place is left out. */
    async stampPlaces(spotIds: string[]): Promise<Map<string, StampPlace>> {
      const found = (await store.findSpots([...new Set(spotIds)])).filter(isStampPlace);
      return new Map(found.map((s) => [s.id, s]));
    },

    check: (r: Reading) => check(r, store, now()),

    /** Saves a stamp whose checks were already done (a guest's, once they sign up). */
    awardMany: (userId: string, items: { spotId: string; flagged: boolean; createdAt: Date }[]) => store.awardMany(userId, items),
    award: (userId: string, spotId: string, flagged: boolean) => store.award(userId, spotId, { flagged, flagReason: flagged ? "low_accuracy" : null }),

    async collect(userId: string, r: Reading): Promise<Result<Collected>> {
      const checked = await check(r, store, now());
      if (!checked.ok) return checked;
      const { spot, flagged, scannedAt } = checked.value;
      const got = await store.award(userId, spot.id, { flagged, flagReason: flagged ? "low_accuracy" : null, scannedAt });
      // A revoked stamp stays on record and blocks a new one; say so instead of "already stamped" with nothing to show.
      if (got.revoked) return { ok: false, reason: "stamp_revoked" };
      return {
        ok: true,
        value: { spotId: spot.id, createdAt: got.createdAt, flagged: got.flagged, alreadyStamped: !got.created, finished: got.finished },
      };
    },

    listMine: (userId: string) => store.listMine(userId),
    listCompletions: (userId: string) => store.listCompletions(userId),
    async setRevoked(actor: string, id: string, revoked: boolean): Promise<Result<true>> {
      return (await store.setRevoked(actor, id, revoked)) === "ok" ? { ok: true, value: true } : { ok: false, reason: "not_found" };
    },
  };
}

export type StampService = ReturnType<typeof createStampService>;

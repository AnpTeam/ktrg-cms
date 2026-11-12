// How far a visitor is. One place gives one stamp; a COURSE is finished when every published stamp place on it is
// stamped; a rally of PLACES (such as the sutra-mound rally) when every published place in it is stamped; a rally
// of COURSES when every course in it is finished. A closed place counts as done (decided 2026-10-15); drafts never
// count. Finishing is saved (rally-store.ts), so a saved finish stands even if more places or courses are added
// later. Pure functions, unit-tested; rally-store.ts reads the data and calls them.

export type SpotStatus = "open" | "caution" | "closed" | "info";

/** A stamp place of a course or of a rally of places. */
export interface PlaceMember {
  spotId: string;
  published: boolean;
  status: SpotStatus;
}

export interface HeldStamp {
  spotId: string;
  createdAt: Date;
  /** A revoked stamp (an admin took it back) counts for nothing. */
  revokedAt: Date | null;
}

export interface PlaceProgress {
  /** Published places (drafts never count). */
  total: number;
  /** Published places the visitor holds a stamp for. */
  stamped: number;
  /** Published places that are closed right now and not stamped: they count as done. */
  waived: number;
  /** Every published place stamped or waived, and there is at least one. */
  complete: boolean;
  /** When the visitor stamped most recently among these places; null if never. */
  lastStampedAt: Date | null;
}

/** Progress over a set of places: a course's stamp places, or a rally of places. */
export function placeProgress(input: { members: readonly PlaceMember[]; stamps: readonly HeldStamp[] }): PlaceProgress {
  const held = new Map<string, Date>();
  for (const s of input.stamps) {
    if (s.revokedAt) continue;
    const previous = held.get(s.spotId);
    if (!previous || s.createdAt > previous) held.set(s.spotId, s.createdAt);
  }

  let total = 0;
  let stamped = 0;
  let waived = 0;
  let last: Date | null = null;
  for (const m of input.members) {
    // An information place (it exists, but offers no stamp) is not part of the count at all.
    if (!m.published || m.status === "info") continue;
    total++;
    const at = held.get(m.spotId);
    if (at) {
      stamped++;
      if (!last || at > last) last = at;
    } else if (m.status === "closed") {
      waived++;
    }
  }
  return { total, stamped, waived, complete: total > 0 && stamped + waived === total, lastStampedAt: last };
}

export interface CourseProgress {
  /** Courses in the rally. */
  total: number;
  /** Courses the visitor has finished (a saved finish, or finished right now). */
  finished: number;
  /** Every course finished, and there is at least one. */
  complete: boolean;
}

/** Progress over a rally of courses: which of its courses are finished. */
export function courseProgress(input: { routeIds: readonly string[]; finishedRouteIds: ReadonlySet<string> }): CourseProgress {
  const total = input.routeIds.length;
  const finished = input.routeIds.filter((id) => input.finishedRouteIds.has(id)).length;
  return { total, finished, complete: total > 0 && finished === total };
}

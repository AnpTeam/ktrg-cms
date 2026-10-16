// How far a visitor is in a rally. Computed from the stamps they hold, never stored per rally:
// a visitor has ONE stamp per place, and it counts in EVERY rally that includes the place
// (a sutra mound is in the mound rally and in its course's rally). Pure functions, unit-tested;
// rally-store.ts reads the data and calls them.

export type SpotStatus = "open" | "caution" | "closed";

export interface RallyMember {
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

export interface Progress {
  /** Published places in the rally (drafts never count). */
  total: number;
  /** Published places the visitor holds a stamp for. */
  stamped: number;
  /** Published places that are closed right now and not stamped: they count as done (decided). */
  waived: number;
  /** How many places complete the rally: stampsRequired, at most the total; everything if not set. */
  required: number;
  /** Stamped plus waived reaches the requirement (and there is something to do). */
  complete: boolean;
  /** When the visitor stamped most recently in this rally; null if never. */
  lastStampedAt: Date | null;
}

export function computeProgress(input: {
  members: readonly RallyMember[];
  stamps: readonly HeldStamp[];
  stampsRequired: number | null;
}): Progress {
  const eligible = input.members.filter((m) => m.published);
  const held = new Map<string, Date>();
  for (const s of input.stamps) {
    if (s.revokedAt) continue;
    const previous = held.get(s.spotId);
    if (!previous || s.createdAt > previous) held.set(s.spotId, s.createdAt);
  }

  let stamped = 0;
  let waived = 0;
  let last: Date | null = null;
  for (const m of eligible) {
    const at = held.get(m.spotId);
    if (at) {
      stamped++;
      if (!last || at > last) last = at;
    } else if (m.status === "closed") {
      waived++;
    }
  }

  const total = eligible.length;
  const required = Math.min(input.stampsRequired ?? total, total);
  return { total, stamped, waived, required, complete: total > 0 && stamped + waived >= required, lastStampedAt: last };
}

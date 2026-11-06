import { fetchPublicNotices } from "./api-content";
import { sampleContentEnabled } from "./content";
import { sampleNotices } from "./sample-notices";

/**
 * A route-level trail notice (a closure, a hazard, a seasonal condition). Entered by hand by an admin after
 * checking an official source (CLAUDE.md, "Spot status and safety"): it always carries the source, the day it
 * was last checked and an optional expiry, and the page always shows how old it is. Japanese is required.
 */
export interface TrailNotice {
  id: string;
  titleJa: string;
  titleEn: string | null;
  bodyJa: string;
  bodyEn: string | null;
  /** The official page the notice was taken from. */
  sourceUrl: string;
  sourceNameJa: string;
  sourceNameEn: string | null;
  /** YYYY-MM-DD, the day a person last checked the source. */
  verifiedOn: string;
  /** YYYY-MM-DD; the notice disappears after this day. null = until someone removes it. */
  expiresOn: string | null;
  /** The route it is about, or null for the whole trail. */
  routeId: string | null;
}

/** Notices that have not expired as of `today` (YYYY-MM-DD, Japan time), the most recently checked first. */
export function activeNotices(list: readonly TrailNotice[], today: string): TrailNotice[] {
  return list
    .filter((n) => n.expiresOn === null || n.expiresOn >= today)
    .sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn));
}

/** Today as YYYY-MM-DD in Japan time. */
export function todayInJapan(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

// Published notices from the API (written in the admin: /admin/notices). With none, and only while sample content
// is on, the sample notices stand in for design review (they say 見本 in their text); production never invents one.
// The API already hides expired ones; filtering again here keeps a cached answer from showing one past its day.
export async function listNotices(): Promise<TrailNotice[]> {
  const real = (await fetchPublicNotices()) ?? [];
  return activeNotices(real.length === 0 && sampleContentEnabled() ? sampleNotices : real, todayInJapan());
}

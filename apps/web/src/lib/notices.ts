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
  /** The course it is about (1 to 19), or null for the whole trail. */
  routeOrder: number | null;
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

/** Only http(s) links are ever rendered from CMS text. */
export const isWebUrl = (value: string) => /^https?:\/\//i.test(value);

// The notices API does not exist yet, so production has none (and the page shows nothing, rather than
// inventing a notice). Sample notices are for design review only and say 見本 in their text.
export async function listNotices(): Promise<TrailNotice[]> {
  return activeNotices(sampleContentEnabled() ? sampleNotices : [], todayInJapan());
}

// Stamp rallies as the stamp page shows them: one rally for the 31 sutra mound places, and one rally
// per course (19). Pure functions, unit-tested; the data comes from lib/content.ts.

export interface RallySlot {
  id: string;
  /** The place in this rally, 1, 2, 3 ... */
  number: number;
  nameJa: string;
  nameEn: string | null;
  /** null when the visitor is not signed in. */
  stamped: boolean | null;
}

export interface RallyItem {
  id: string;
  /** "mounds" and "course" are the sample rallies; "rally" is any rally the CMS publishes (a list of places or of courses). */
  kind: "mounds" | "course" | "rally";
  /** 0 for the mound rally, the course number (1 to 19) for a course. */
  order: number;
  nameJa: string;
  nameEn: string | null;
  /** The course's page; null for the mound rally. */
  routeId: string | null;
  total: number;
  /** Stamps held; null when not signed in. */
  stamped: number | null;
  /** ISO time of the visitor's latest stamp in this rally; null if none or signed out. */
  lastStampedAt: string | null;
  slots: RallySlot[];
}

/**
 * What a stamp seal says besides its number, for the sutra mound rally only (other rallies show just the number).
 * A mound's name is "place・chapter" (友ヶ島・序品): the place can be long, so the seal shows only the chapter, the
 * part after the last "・". It is always the Japanese chapter, in every language: the romanised chapter names
 * (Gohyakudeshijukihon, Yakuoubosatsuhonjihon ...) are long single words that do not fit a seal, while the kanji
 * are short and are the real inscription. The English name stays in the rally list. A name with no separator
 * is shown as it is.
 */
export function sealName(nameJa: string): string {
  const parts = nameJa.split("・");
  return (parts[parts.length - 1] as string).trim() || nameJa;
}

/** A rally with no places yet (a course whose spots are not published) is shown as 準備中. */
export const isSoon = (rally: RallyItem) => rally.total === 0;

/**
 * The rally to show first: the one the visitor stamped in most recently. If they have not stamped
 * anywhere, the mound rally (the main one); with nothing at all, null. Rallies with no places yet
 * are never featured.
 */
export function pickFeatured(rallies: readonly RallyItem[]): RallyItem | null {
  const ready = rallies.filter((r) => !isSoon(r));
  const stamped = ready.filter((r) => r.lastStampedAt !== null);
  if (stamped.length > 0) {
    return stamped.reduce((best, r) => (Date.parse(r.lastStampedAt!) > Date.parse(best.lastStampedAt!) ? r : best));
  }
  return ready.find((r) => r.kind === "mounds") ?? ready[0] ?? null;
}

/** Every rally except the featured one: the mound rally first, then the courses in trail order. */
export function otherRallies(rallies: readonly RallyItem[], featured: RallyItem | null): RallyItem[] {
  return rallies.filter((r) => r.id !== featured?.id).sort((a, b) => a.order - b.order);
}

/** The first place not yet stamped, or undefined when all are (or the visitor is signed out). */
export function nextSlot(rally: RallyItem): RallySlot | undefined {
  if (rally.stamped === null) return undefined;
  return rally.slots.find((s) => s.stamped === false);
}

/** The stamped place numbers, for the stamp grid. */
export function stampedNumbers(rally: RallyItem): Set<number> {
  return new Set(rally.slots.filter((s) => s.stamped === true).map((s) => s.number));
}

// A running navigation survives a reload. The phone may drop the page while another one is on top (the in-app browser a
// timetable link opens, or a call); coming back reloads it, and without this the visitor would be dropped out of
// navigation. Only the course's id and the time are kept, in this browser: no position, no stamp, no token. Ending the
// navigation by hand clears it; so does age.

export interface ResumeRecord {
  routeId: string;
  /** ms since the epoch when the navigation started. */
  at: number;
}

/** A navigation older than this is not picked up again (the walk is surely over). */
export const RESUME_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const KEY = "ktrg-nav-resume";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveResume(store: Store | undefined, rec: ResumeRecord): void {
  try {
    store?.setItem(KEY, JSON.stringify(rec));
  } catch {
    // private window or blocked storage: navigation just cannot be resumed
  }
}

export function clearResume(store: Store | undefined): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

/** The saved navigation, or null when there is none, it is malformed, or it is too old (then it is dropped). */
export function loadResume(store: Store | undefined, now: number): ResumeRecord | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ResumeRecord>;
    if (typeof v.routeId === "string" && v.routeId !== "" && typeof v.at === "number" && now - v.at >= 0 && now - v.at <= RESUME_MAX_AGE_MS) return { routeId: v.routeId, at: v.at };
    store?.removeItem(KEY);
    return null;
  } catch {
    return null;
  }
}

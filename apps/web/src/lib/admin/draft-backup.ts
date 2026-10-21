import type { RouteDraft } from "./route-draft";

// A copy of the route being edited, kept in this browser while it has changes that are not saved, so a failed save, a crash or
// a closed tab does not cost the work. It lives only on this device (the page's own storage), holds only what the editor
// shows, and is removed as soon as everything is saved. Pure apart from the storage it is given, so it is tested without a browser.

export interface Backup {
  /** When the copy was made (ISO). */
  at: string;
  /** The update time of the saved route the edits started from: a copy of an older version is not offered. */
  base: string | null;
  draft: RouteDraft;
}

export const backupKey = (routeId: string | null) => `route-draft-backup:${routeId ?? "new"}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The copy as stored text, or null when none is kept or it is not one of ours. */
export function parseBackup(raw: string | null): Backup | null {
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Partial<Backup> | null;
    if (b && typeof b.at === "string" && (b.base === null || typeof b.base === "string") && b.draft && Array.isArray(b.draft.places) && Array.isArray(b.draft.legs)) return b as Backup;
  } catch {
    // not ours
  }
  return null;
}

/** Keep the copy (or drop it when there is nothing unsaved). Storage that is full or blocked is no reason to stop editing. */
export function writeBackup(store: Store, draft: RouteDraft, base: string | null, unsaved: boolean, now = new Date()): void {
  try {
    if (unsaved) store.setItem(backupKey(draft.id), JSON.stringify({ at: now.toISOString(), base, draft } satisfies Backup));
    else {
      store.removeItem(backupKey(draft.id));
      store.removeItem(backupKey(null)); // a route that was new and has now been saved leaves no copy under "new"
    }
  } catch {
    // not kept this time
  }
}

/** Whether a stored copy is worth offering: it started from this saved version and differs from it. */
export const worthRestoring = (b: Backup | null, saved: RouteDraft): b is Backup =>
  b !== null && b.base === saved.updatedAt && JSON.stringify(b.draft) !== JSON.stringify(saved);

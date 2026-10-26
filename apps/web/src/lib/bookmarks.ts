// Routes a visitor saved to come back to. Kept on the device (localStorage), not on the account: nothing to sign in for.

export interface Bookmark {
  id: string;
  nameJa: string;
  nameEn: string | null;
}

export const BOOKMARKS_KEY = "ktrg-bookmarks";

/** What was stored, or none when it is missing or damaged (a bad value must never break the page). */
export function parseBookmarks(raw: string | null): Bookmark[] {
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.flatMap((b): Bookmark[] => {
      const { id, nameJa, nameEn } = (b ?? {}) as Record<string, unknown>;
      return typeof id === "string" && typeof nameJa === "string" ? [{ id, nameJa, nameEn: typeof nameEn === "string" ? nameEn : null }] : [];
    });
  } catch {
    return [];
  }
}

/** Adds the route, or removes it when it is already there. Newest first. */
export function toggleBookmark(list: readonly Bookmark[], item: Bookmark): Bookmark[] {
  return list.some((b) => b.id === item.id) ? list.filter((b) => b.id !== item.id) : [item, ...list];
}

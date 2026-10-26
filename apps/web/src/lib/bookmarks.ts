// Routes a visitor saved to come back to. Signed out they are kept on the device (localStorage); signed in, on the account
// (PATCH /me), and what the device held is moved over at login. Only the route's id is kept: its name is looked up when shown.

export const BOOKMARKS_KEY = "ktrg-bookmarks";

/** What was stored, or none when it is missing or damaged (a bad value must never break the page). Older copies held objects with an id. */
export function parseBookmarks(raw: string | null): string[] {
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.flatMap((b): string[] => {
      const id = typeof b === "string" ? b : typeof (b as { id?: unknown } | null)?.id === "string" ? (b as { id: string }).id : null;
      return id ? [id] : [];
    });
  } catch {
    return [];
  }
}

/** Adds the route to the front, or removes it when it is already there. */
export function toggleBookmark(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((b) => b !== id) : [id, ...list];
}

/** The device's bookmarks (newest) in front of the account's, each route once. */
export function mergeBookmarks(account: readonly string[], device: readonly string[]): string[] {
  return [...new Set([...device, ...account])];
}

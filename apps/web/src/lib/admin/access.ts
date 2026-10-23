import type { Viewer } from "../viewer";

/**
 * What the admin area does with a visitor: send them to log in, tell them it is not for them, or let them in.
 * This only decides what to show. Every admin call is checked again by the API (route.manage and friends), so
 * a visitor who skips this screen still gets 401 or 403 there.
 */
export function adminAccess(viewer: Pick<Viewer, "signedIn" | "role">): "login" | "forbidden" | "ok" {
  if (!viewer.signedIn) return "login";
  // An editor works on the content; the pages only an admin may use (settings) are hidden from the menu and refused by the API.
  return viewer.role === "admin" || viewer.role === "editor" ? "ok" : "forbidden";
}

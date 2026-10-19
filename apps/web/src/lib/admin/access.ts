import type { Viewer } from "../viewer";

/**
 * What the admin area does with a visitor: send them to log in, tell them it is not for them, or let them in.
 * This only decides what to show. Every admin call is checked again by the API (route.manage and friends), so
 * a visitor who skips this screen still gets 401 or 403 there.
 */
export function adminAccess(viewer: Pick<Viewer, "signedIn" | "role">): "login" | "forbidden" | "ok" {
  if (!viewer.signedIn) return "login";
  return viewer.role === "admin" ? "ok" : "forbidden";
}

import type { Role } from "./user";

export type { Role };

/**
 * THE permission table: who may do what, in one place.
 *
 * - To allow or forbid something, change THIS table. Nothing else in the code names a role.
 * - Roles are listed explicitly: "admin" does not quietly mean "everything", so reading a
 *   line tells you exactly who can do it.
 * - A new permission must be added here before a route can use it (it is type checked).
 * - Anything not listed is forbidden to everyone.
 */
export const PERMISSIONS = {
  // --- Any logged-in account -------------------------------------------------------------
  /** Own profile, language, passkeys and account deletion request. */
  "me.manage": ["participant", "editor", "admin"],
  /**
   * Account security: add or remove a passkey, ask for the account to be deleted. Needs a fresh login (below),
   * so someone holding a signed-in phone cannot give themselves a login that outlives the owner's changes.
   */
  "me.sensitive": ["participant", "editor", "admin"],
  /** Collect a stamp at a spot. */
  "stamp.create": ["participant", "editor", "admin"],
  /** Download a route as a GPX file. */
  "route.gpx": ["participant", "editor", "admin"],
  /** Ask for a walking path to a stamp place while off the course line (navigation; the server calls OpenRouteService). */
  "navigation.path": ["participant", "editor", "admin"],

  // --- The CMS: content work is for an editor and an admin; settings, history and accounts are for an admin only -----
  "route.manage": ["editor", "admin"],
  "spot.manage": ["editor", "admin"],
  /** Publish or unpublish a spot (needs coordinates and confirmed site permission). */
  "spot.publish": ["editor", "admin"],
  "rally.manage": ["editor", "admin"],
  /** Dated trail notices and spot status. */
  "notice.manage": ["editor", "admin"],
  /** Write and publish blog posts. */
  "post.manage": ["editor", "admin"],
  /** Write a comment under a blog post (it waits for approval unless the writer is on the staff). */
  "comment.create": ["participant", "editor", "admin"],
  "upload.create": ["editor", "admin"],
  /** Browse the photos already uploaded (the photo library). */
  "upload.read": ["editor", "admin"],
  /** The photos in the home page carousel. */
  "banner.manage": ["editor", "admin"],
  /** The words furigana is drawn over, and their readings. */
  "furigana.manage": ["editor", "admin"],
  /** Settings for the whole site (the map style): they change the live site at once. */
  "site.manage": ["admin"],
  /** Review flagged stamps and revoke them. */
  "stamp.review": ["admin"],
  "audit.read": ["admin"],
  /** See the list of accounts (the users screen). No fresh login: only changing a role needs one. */
  "user.read": ["admin"],
  /** Change another account's role. Also needs a fresh login (below). */
  "user.manage_roles": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Permissions that also need a fresh login: a login or POST /auth/reauth/verify within
 * FRESH_LOGIN_MS. The guard enforces this, so a route only names the permission.
 */
export const FRESH_LOGIN_REQUIRED: readonly Permission[] = ["user.manage_roles", "me.sensitive"];

export function needsFreshLogin(permission: Permission): boolean {
  return FRESH_LOGIN_REQUIRED.includes(permission);
}

/** May an account with this role do this? Unknown roles and unknown permissions are refused. */
export function can(role: Role, permission: Permission): boolean {
  // Only the table's own entries count: "constructor" or "__proto__" are not permissions.
  if (!Object.hasOwn(PERMISSIONS, permission)) return false;
  const allowed: readonly string[] = PERMISSIONS[permission];
  return allowed.includes(role);
}

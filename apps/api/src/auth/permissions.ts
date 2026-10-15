import type { AuthUser } from "./otp-service";

/** The roles an account can have. Matches the user_role type in the database. */
export type Role = AuthUser["role"];

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
  "me.manage": ["participant", "admin"],
  /** Collect a stamp at a spot. */
  "stamp.create": ["participant", "admin"],

  // --- Admin CMS only --------------------------------------------------------------------
  "route.manage": ["admin"],
  "spot.manage": ["admin"],
  /** Publish or unpublish a spot (needs coordinates and confirmed site permission). */
  "spot.publish": ["admin"],
  "rally.manage": ["admin"],
  /** Dated trail notices and spot status. */
  "notice.manage": ["admin"],
  "upload.create": ["admin"],
  /** Review flagged stamps and revoke them. */
  "stamp.review": ["admin"],
  "audit.read": ["admin"],
  /** Change another account's role. Also needs a fresh login (WBS 2.1.12). */
  "user.manage_roles": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** May an account with this role do this? Unknown roles and unknown permissions are refused. */
export function can(role: Role, permission: Permission): boolean {
  // Only the table's own entries count: "constructor" or "__proto__" are not permissions.
  if (!Object.hasOwn(PERMISSIONS, permission)) return false;
  const allowed: readonly string[] = PERMISSIONS[permission];
  return allowed.includes(role);
}

import { describe, expect, test } from "bun:test";
import { userRole } from "../db/schema";
import { FRESH_LOGIN_REQUIRED, PERMISSIONS, can, needsFreshLogin, type Permission, type Role } from "./permissions";

const permissions = Object.keys(PERMISSIONS) as Permission[];

describe("permission table", () => {
  test("the roles match the user_role type in the database", () => {
    expect([...userRole.enumValues].sort()).toEqual(["admin", "editor", "participant"]);
  });

  test("every permission names at least one role, with no repeats and no unknown roles", () => {
    const valid: readonly string[] = userRole.enumValues;
    for (const p of permissions) {
      const roles: readonly string[] = PERMISSIONS[p];
      expect(roles.length).toBeGreaterThan(0);
      expect(new Set(roles).size).toBe(roles.length);
      for (const r of roles) expect(valid).toContain(r);
    }
  });

  test("participants can only do these things (a change here must be deliberate)", () => {
    const forParticipant: string[] = permissions.filter((p) => can("participant", p)).sort();
    expect(forParticipant).toEqual(["me.manage", "me.sensitive", "navigation.path", "stamp.create"]);
  });

  test("admins can do everything participants can, plus the CMS", () => {
    const forAdmin: string[] = permissions.filter((p) => can("admin", p)).sort();
    expect(forAdmin).toEqual(
      [
        "audit.read",
        "banner.manage",
        "site.manage",
        "me.manage",
        "me.sensitive",
        "navigation.path",
        "notice.manage",
        "rally.manage",
        "route.manage",
        "spot.manage",
        "spot.publish",
        "stamp.create",
        "stamp.review",
        "upload.create",
        "upload.read",
        "user.read",
        "user.manage_roles",
      ].sort(),
    );
  });

  test("every CMS permission is admin-only", () => {
    const cms = permissions.filter((p) => p !== "me.manage" && p !== "me.sensitive" && p !== "stamp.create" && p !== "navigation.path");
    expect(cms.length).toBeGreaterThan(0);
    for (const p of cms) {
      expect(can("participant", p)).toBe(false);
      expect(can("admin", p)).toBe(true);
    }
  });
});

describe("the editor role", () => {
  const ADMIN_ONLY = ["audit.read", "site.manage", "stamp.review", "user.manage_roles", "user.read"];

  test("an editor does the content work and the participant things, and nothing about accounts, settings, history or revoking stamps", () => {
    const forEditor: string[] = permissions.filter((p) => can("editor", p)).sort();
    const forAdmin: string[] = permissions.filter((p) => can("admin", p)).sort();
    expect(forAdmin.filter((p) => !forEditor.includes(p))).toEqual(ADMIN_ONLY);
    for (const p of ["route.manage", "spot.manage", "spot.publish", "rally.manage", "notice.manage", "banner.manage", "upload.create", "upload.read", "me.manage", "stamp.create"]) {
      expect(can("editor", p as Permission)).toBe(true);
    }
  });
});

describe("can", () => {
  test("answers per role and permission", () => {
    expect(can("participant", "me.manage")).toBe(true);
    expect(can("participant", "route.manage")).toBe(false);
    expect(can("admin", "route.manage")).toBe(true);
  });

  test("an unknown role or permission is refused, never allowed", () => {
    expect(can("superuser" as Role, "me.manage")).toBe(false);
    expect(can("admin", "nuke.everything" as Permission)).toBe(false);
    expect(can(undefined as unknown as Role, "me.manage")).toBe(false);
  });

  test("a prototype-chain name is not a permission", () => {
    expect(can("admin", "constructor" as Permission)).toBe(false);
    expect(can("admin", "__proto__" as Permission)).toBe(false);
  });
});

describe("fresh-login permissions", () => {
  test("changing roles needs a fresh login; everyday permissions do not", () => {
    expect(needsFreshLogin("user.manage_roles")).toBe(true);
    expect(needsFreshLogin("me.sensitive")).toBe(true);
    expect(needsFreshLogin("me.manage")).toBe(false);
    expect(needsFreshLogin("route.manage")).toBe(false);
  });

  test("a participant is only ever asked for a re-check for account security (me.sensitive)", () => {
    for (const p of FRESH_LOGIN_REQUIRED) {
      expect(Object.hasOwn(PERMISSIONS, p)).toBe(true);
      if (p !== "me.sensitive") expect(can("participant", p)).toBe(false);
    }
  });
});

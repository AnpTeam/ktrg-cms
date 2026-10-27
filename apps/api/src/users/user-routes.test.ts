import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { listReadRoutes } from "../admin-lists/list-routes";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryUserListStore, createUserListService, userList } from "./user-list";
import { userRoleRoutes } from "./user-routes";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const boss: AuthUser = { id: "33333333-3333-4333-8333-333333333333", email: "boss@example.com", role: "admin", locale: "ja" };

function setup() {
  let clock = new Date("2026-10-20T00:00:00Z");
  const users = new Map<string, AuthUser>([[admin.id, admin], [alice.id, alice], [boss.id, boss]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store, now: () => clock });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryUserListStore(audit.writer);
  for (const u of [admin, alice, boss]) {
    mem.rows.set(u.id, { id: u.id, publicId: u.id.slice(0, 8), email: u.email, displayName: null, role: u.role, origin: null, ageRange: null, gender: null, foundVia: null, restrictedAt: null, restrictedUntil: null, restrictionReason: null, deletionRequestedAt: null, restricted: false, deletionPending: false, createdAt: clock, updatedAt: clock });
  }
  const services = {
    session,
    audit: audit.writer,
    rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) }),
    userList: createUserListService({ store: mem.store }),
  };
  const opts = { secureCookies: false };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(listReadRoutes(userList, () => services, opts)).use(userRoleRoutes(() => services, opts));
  const call = async (method: string, path: string, cookie?: string, body?: unknown) => {
    const res = await app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const login = async (u: AuthUser) => `session=${(await session.create(u)).token}`;
  const later = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
  const at = (id: string) => mem.rows.get(id)!.updatedAt.toISOString();
  return { call, login, later, at, mem, audit };
}

describe("users and roles", () => {
  test("only an admin may list accounts, with no fresh login needed; a participant gets 403, signed out 401", async () => {
    const s = setup();
    expect((await s.call("GET", "/admin/lists/users")).status).toBe(401);
    expect((await s.call("GET", "/admin/lists/users", await s.login(alice))).status).toBe(403);
    const cookie = await s.login(admin);
    s.later(11); // the login is no longer fresh: reading still works
    const list = await s.call("GET", "/admin/lists/users", cookie);
    expect((list.body.items as unknown[]).length).toBe(3);
  });

  test("a role change needs a fresh login, then ends that account's sessions and is audited", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    s.later(11); // the login is no longer fresh
    const stale = await s.call("PATCH", `/admin/lists/users/${alice.id}`, cookie, { updatedAt: s.at(alice.id), role: "admin" });
    expect(stale).toEqual({ status: 403, body: { ok: false, error: "reauth_required" } });
    expect(s.mem.rows.get(alice.id)!.role).toBe("participant");

    const fresh = await s.login(admin);
    const done = await s.call("PATCH", `/admin/lists/users/${alice.id}`, fresh, { updatedAt: s.at(alice.id), role: "admin" });
    expect(done.status).toBe(200);
    expect(s.mem.rows.get(alice.id)!.role).toBe("admin");
    expect(s.mem.endedSessions).toEqual([alice.id]);
    expect(s.audit.rows.map((r) => [r.action, r.targetId, r.actorUserId])).toEqual([["user.role.change", alice.id, admin.id]]);
  });

  test("nobody changes their own role; a stale copy is a conflict; a participant cannot change roles", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    expect(await s.call("PATCH", `/admin/lists/users/${admin.id}`, cookie, { updatedAt: s.at(admin.id), role: "participant" })).toEqual({
      status: 409,
      body: { ok: false, error: "cannot_change_own_role" },
    });
    expect((await s.call("PATCH", `/admin/lists/users/${alice.id}`, cookie, { updatedAt: new Date(0).toISOString(), role: "admin" })).status).toBe(409);
    expect((await s.call("PATCH", `/admin/lists/users/${admin.id}`, await s.login(alice), { updatedAt: s.at(admin.id), role: "participant" })).status).toBe(403);
    expect([...s.mem.rows.values()].map((u) => u.role).sort()).toEqual(["admin", "admin", "participant"]);
    expect(s.audit.rows).toHaveLength(0);
  });
});

describe("restricting and deleting accounts", () => {
  // Real time: the in-memory store decides "in force" by the real clock, as the database one does.
  const until = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  test("restricting needs a fresh login, a reason and a future end; it shows in the list and is audited by id only", async () => {
    const s = setup();
    const stale = await s.login(admin);
    s.later(11);
    expect(await s.call("PUT", `/admin/lists/users/${alice.id}/restriction`, stale, { reason: "spam", until: null })).toEqual({ status: 403, body: { ok: false, error: "reauth_required" } });
    const cookie = await s.login(admin);
    expect((await s.call("PUT", `/admin/lists/users/${alice.id}/restriction`, cookie, { reason: "  ", until: null })).status).toBe(422);
    expect((await s.call("PUT", `/admin/lists/users/${alice.id}/restriction`, cookie, { reason: "spam", until: until(-1) })).status).toBe(422);
    const done = await s.call("PUT", `/admin/lists/users/${alice.id}/restriction`, cookie, { reason: "spam comments", until: until(7) });
    expect(done.status).toBe(200);
    expect(done.body.item).toMatchObject({ restricted: true, restrictionReason: "spam comments" });
    expect((await s.call("GET", `/admin/lists/users/${alice.id}`, cookie)).body.item).toMatchObject({ restricted: true });
    expect(s.audit.rows.map((r) => [r.action, r.targetId])).toEqual([["user.restrict", alice.id]]);
    expect(JSON.stringify(s.audit.rows)).not.toContain("spam");
    const lifted = await s.call("DELETE", `/admin/lists/users/${alice.id}/restriction`, cookie);
    expect(lifted.body.item).toMatchObject({ restricted: false, restrictionReason: null });
    expect(s.audit.rows.map((r) => r.action)).toEqual(["user.restrict", "user.restriction_lift"]);
  });

  test("not your own account and not another admin's, for every action; participants and editors cannot", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    for (const [method, path, body] of [
      ["PUT", "/restriction", { reason: "x", until: null }],
      ["DELETE", "/restriction", undefined],
      ["POST", "/deletion-request", undefined],
      ["DELETE", "", undefined],
    ] as const) {
      expect((await s.call(method, `/admin/lists/users/${admin.id}${path}`, cookie, body)).body).toEqual({ ok: false, error: "cannot_manage_self" });
      expect((await s.call(method, `/admin/lists/users/${boss.id}${path}`, cookie, body)).body).toEqual({ ok: false, error: "cannot_manage_admin" });
      expect((await s.call(method, `/admin/lists/users/${alice.id}${path}`, await s.login(alice), body)).status).toBe(403);
      expect((await s.call(method, `/admin/lists/users/${alice.id}${path}`, undefined, body)).status).toBe(401);
    }
    expect(s.mem.deleted).toEqual([]);
    expect(s.audit.rows).toEqual([]);
  });

  test("deletion after the grace period can be asked for and cancelled; delete now removes the account at once", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const asked = await s.call("POST", `/admin/lists/users/${alice.id}/deletion-request`, cookie);
    expect(asked.body.item).toMatchObject({ deletionPending: true });
    const again = await s.call("POST", `/admin/lists/users/${alice.id}/deletion-request`, cookie);
    expect(again.status).toBe(200);
    expect((await s.call("DELETE", `/admin/lists/users/${alice.id}/deletion-request`, cookie)).body.item).toMatchObject({ deletionPending: false });
    expect(s.audit.rows.map((r) => r.action)).toEqual(["user.deletion_request_by_admin", "user.deletion_cancel_by_admin"]);

    expect((await s.call("DELETE", `/admin/lists/users/${alice.id}`, cookie)).body).toEqual({ ok: true });
    expect(s.mem.deleted).toEqual([alice.id]);
    expect(s.audit.rows.at(-1)).toMatchObject({ action: "user.deleted_by_admin", targetId: alice.id, actorUserId: admin.id });
    expect((await s.call("DELETE", `/admin/lists/users/${alice.id}`, cookie)).status).toBe(404);
  });
});

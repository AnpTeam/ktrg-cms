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

function setup() {
  let clock = new Date("2026-10-20T00:00:00Z");
  const users = new Map<string, AuthUser>([[admin.id, admin], [alice.id, alice]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store, now: () => clock });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryUserListStore(audit.writer);
  for (const u of [admin, alice]) {
    mem.rows.set(u.id, { id: u.id, publicId: u.id.slice(0, 8), email: u.email, displayName: null, role: u.role, origin: null, ageRange: null, gender: null, foundVia: null, createdAt: clock, updatedAt: clock });
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
    expect((list.body.items as unknown[]).length).toBe(2);
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
    expect([...s.mem.rows.values()].map((u) => u.role).sort()).toEqual(["admin", "participant"]);
    expect(s.audit.rows).toHaveLength(0);
  });
});

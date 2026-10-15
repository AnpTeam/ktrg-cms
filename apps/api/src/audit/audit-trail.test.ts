import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { authGuards } from "../auth/guards";
import type { AuthUser } from "../auth/otp-service";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import { createMemoryAuditWriter, type AuditWriter } from "./audit-log";
import { auditTrail } from "./audit-trail";

const alice: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "participant", locale: "ja" };
const root: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "root@example.com", role: "admin", locale: "en" };
const thing = "33333333-3333-4333-8333-333333333333";

function setup(opts: { failingWriter?: boolean } = {}) {
  const users = new Map<string, AuthUser>([
    [alice.id, { ...alice }],
    [root.id, { ...root }],
  ]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const memory = createMemoryAuditWriter();
  const failing: AuditWriter = {
    async record() {
      throw new Error("database down");
    },
  };
  const logs: string[] = [];

  const app = new Elysia()
    .use(authGuards({ getSession: () => session, secureCookies: false }))
    .use(auditTrail({ getAudit: () => (opts.failingWriter ? failing : memory.writer), log: (l) => logs.push(l) }))
    // target = :id (the default)
    .delete("/passkeys/:id", () => ({ ok: true }), { auth: "me.manage", audit: "passkey.remove" })
    // target = the logged-in user
    .post("/reauth", () => ({ ok: true }), { auth: "me.manage", audit: { action: "session.reauth", target: "self" } })
    // target = a field of the response
    .post("/passkeys", () => ({ ok: true, passkey: { id: thing, label: "My iPhone" } }), {
      auth: "me.manage",
      audit: { action: "passkey.add", target: "response:passkey.id" },
    })
    // the handler refuses in different ways
    .delete(
      "/missing/:id",
      ({ set }) => {
        set.status = 404;
        return { ok: false };
      },
      { auth: "me.manage", audit: "passkey.remove" },
    )
    .delete("/conflict/:id", ({ status }) => status(409, { ok: false }), { auth: "me.manage", audit: "passkey.remove" })
    .delete(
      "/boom/:id",
      () => {
        throw new Error("boom");
      },
      { auth: "me.manage", audit: "passkey.remove" },
    )
    // admin-only, to check a guard refusal is not audited
    .delete("/admin/:id", () => ({ ok: true }), { auth: "route.manage", audit: "passkey.remove" })
    // no audit option: nothing is written
    .post("/quiet", () => ({ ok: true }), { auth: "me.manage" });

  const call = (method: string, path: string, cookie?: string) =>
    app.handle(new Request(`http://localhost${path}`, { method, headers: cookie ? { cookie } : {} }));
  const login = async (user: AuthUser) => `session=${(await session.create(users.get(user.id)!)).token}`;
  return { call, login, rows: memory.rows, logs };
}

describe("a successful request is recorded with ids only", () => {
  test("target from the :id parameter", async () => {
    const { call, login, rows } = setup();
    const res = await call("DELETE", `/passkeys/${thing}`, await login(alice));
    expect(res.status).toBe(200);
    expect(rows).toEqual([{ actorUserId: alice.id, action: "passkey.remove", targetType: "passkey", targetId: thing }]);
  });

  test("target = the logged-in user", async () => {
    const { call, login, rows } = setup();
    await call("POST", "/reauth", await login(root));
    expect(rows).toEqual([{ actorUserId: root.id, action: "session.reauth", targetType: "user", targetId: root.id }]);
  });

  test("target from the response, which is passed through unchanged", async () => {
    const { call, login, rows } = setup();
    const res = await call("POST", "/passkeys", await login(alice));
    expect(await res.json()).toEqual({ ok: true, passkey: { id: thing, label: "My iPhone" } });
    expect(rows).toEqual([{ actorUserId: alice.id, action: "passkey.add", targetType: "passkey", targetId: thing }]);
  });

  test("nothing from the request but the two ids is stored: no email, label, IP or body", async () => {
    const { call, login, rows } = setup();
    await call("POST", "/passkeys", await login(alice));
    const stored = JSON.stringify(rows);
    for (const pii of [alice.email!, "My iPhone", "127.0.0.1", "session="]) expect(stored).not.toContain(pii);
  });

  test("a route without the audit option writes nothing", async () => {
    const { call, login, rows } = setup();
    expect((await call("POST", "/quiet", await login(alice))).status).toBe(200);
    expect(rows).toEqual([]);
  });
});

describe("nothing is recorded when nothing changed", () => {
  test("not logged in (401) or not allowed (403)", async () => {
    const { call, login, rows } = setup();
    expect((await call("DELETE", `/passkeys/${thing}`)).status).toBe(401);
    expect((await call("DELETE", `/admin/${thing}`, await login(alice))).status).toBe(403);
    expect(rows).toEqual([]);
  });

  test("the handler answered 404 (set.status) or 409 (status())", async () => {
    const { call, login, rows } = setup();
    const cookie = await login(alice);
    expect((await call("DELETE", `/missing/${thing}`, cookie)).status).toBe(404);
    expect((await call("DELETE", `/conflict/${thing}`, cookie)).status).toBe(409);
    expect(rows).toEqual([]);
  });

  test("the handler threw (500)", async () => {
    const { call, login, rows } = setup();
    expect((await call("DELETE", `/boom/${thing}`, await login(alice))).status).toBe(500);
    expect(rows).toEqual([]);
  });
});

describe("when the audit write fails", () => {
  test("the change that already happened still answers 200, and the failure is logged", async () => {
    const { call, login, logs } = setup({ failingWriter: true });
    const res = await call("DELETE", `/passkeys/${thing}`, await login(alice));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(logs).toEqual(["[audit] could not record passkey.remove: database down"]);
  });

  test("a target that is not an id is refused, and the log does not repeat it", async () => {
    const { call, login, rows, logs } = setup();
    // The route only checks for a string here, so a non-id reaches the middleware.
    const res = await call("DELETE", "/passkeys/someone@example.com", await login(alice));
    expect(res.status).toBe(200);
    expect(rows).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("targetId must be a UUID");
    expect(logs[0]).not.toContain("someone@example.com");
  });
});

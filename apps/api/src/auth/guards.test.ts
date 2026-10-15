import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { authGuards } from "./guards";
import type { AuthUser } from "./otp-service";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";

const DAY = 24 * 3600 * 1000;
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "ja" };
const root: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "root@example.com", role: "admin", locale: "en" };

function setup(opts: { secureCookies?: boolean } = {}) {
  const users = new Map<string, AuthUser>([
    [alice.id, { ...alice }],
    [root.id, { ...root }],
  ]);
  const sessions = createMemorySessionStore(users);
  let clock = new Date("2026-10-15T00:00:00Z");
  const session = createSessionService({ store: sessions.store, now: () => clock });

  const app = new Elysia({ prefix: "/api/v1" })
    .use(authGuards({ getSession: () => session, secureCookies: opts.secureCookies ?? false }))
    .get("/public", () => ({ ok: true }))
    .get("/me", ({ user }) => ({ id: user.id, role: user.role }), { auth: "me.manage" })
    .post("/routes", ({ user }) => ({ created: true, by: user.id }), { auth: "route.manage" })
    .get("/audit", () => ({ rows: [] }), { auth: "audit.read" });

  const call = (method: string, path: string, cookie?: string) =>
    app.handle(new Request(`http://localhost/api/v1${path}`, { method, headers: cookie ? { cookie } : {} }));
  const login = async (user: AuthUser) => `session=${(await session.create(users.get(user.id)!)).token}`;

  return { call, login, session, users, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("a route with no guard", () => {
  test("is open to everyone", async () => {
    const { call } = setup();
    expect((await call("GET", "/public")).status).toBe(200);
  });
});

describe("not logged in: 401", () => {
  test("no cookie", async () => {
    const res = await setup().call("GET", "/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthenticated" });
  });

  test("a made-up or tampered cookie", async () => {
    const { call, login } = setup();
    expect((await call("GET", "/me", "session=not-a-real-token")).status).toBe(401);
    expect((await call("GET", "/me", (await login(alice)) + "x")).status).toBe(401);
  });

  test("a session that has expired", async () => {
    const { call, login, advance } = setup();
    const cookie = await login(root); // admin: 14 days idle
    advance(15 * DAY);
    expect((await call("GET", "/audit", cookie)).status).toBe(401);
  });

  test("a logged-out (deleted) session", async () => {
    const { call, session } = setup();
    const token = (await session.create(alice)).token;
    const cookie = `session=${token}`;
    expect((await call("GET", "/me", cookie)).status).toBe(200);

    await session.destroy(token); // what logout does on the server

    expect((await call("GET", "/me", cookie)).status).toBe(401);
  });

  test("the answer is the same wherever you ask, so it reveals nothing about the route", async () => {
    const { call } = setup();
    const a = await (await call("GET", "/me")).json();
    const b = await (await call("POST", "/routes")).json();
    const c = await (await call("GET", "/audit")).json();
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe("logged in without the permission: 403", () => {
  test("a participant cannot use an admin route", async () => {
    const { call, login } = setup();
    const cookie = await login(alice);

    for (const [method, path] of [["POST", "/routes"], ["GET", "/audit"]] as const) {
      const res = await call(method, path, cookie);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: "forbidden" });
    }
  });

  test("403 says nothing about why", async () => {
    const { call, login } = setup();
    const body = JSON.stringify(await (await call("POST", "/routes", await login(alice))).json());
    expect(body).not.toMatch(/admin|role|permission|route\.manage/i);
  });
});

describe("allowed", () => {
  test("a participant can use a participant route and the handler gets the user", async () => {
    const { call, login } = setup();
    const res = await call("GET", "/me", await login(alice));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: alice.id, role: "participant" });
  });

  test("an admin can use admin routes and participant routes", async () => {
    const { call, login } = setup();
    const cookie = await login(root);
    expect(await (await call("POST", "/routes", cookie)).json()).toEqual({ created: true, by: root.id });
    expect((await call("GET", "/audit", cookie)).status).toBe(200);
    expect((await call("GET", "/me", cookie)).status).toBe(200);
  });
});

describe("the role is read fresh on every request", () => {
  test("demoting an admin takes effect on their very next request", async () => {
    const { call, login, users } = setup();
    const cookie = await login(root);
    expect((await call("POST", "/routes", cookie)).status).toBe(200);

    users.get(root.id)!.role = "participant"; // an admin demotes them; their session is still valid

    expect((await call("POST", "/routes", cookie)).status).toBe(403);
    expect((await call("GET", "/me", cookie)).status).toBe(200); // still a normal user
  });

  test("promoting a participant takes effect immediately, with no new login", async () => {
    const { call, login, users } = setup();
    const cookie = await login(alice);
    expect((await call("GET", "/audit", cookie)).status).toBe(403);

    users.get(alice.id)!.role = "admin";

    expect((await call("GET", "/audit", cookie)).status).toBe(200);
  });
});

describe("the session cookie", () => {
  test("is re-issued when the idle window slides forward", async () => {
    const { call, login, advance } = setup();
    const cookie = await login(root);
    advance(10 * DAY);

    const res = await call("GET", "/me", cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^session=.+Max-Age=\d+/);
  });

  test("uses the __Host- name in production", async () => {
    const { call } = setup({ secureCookies: true });
    // a plain "session" cookie is not accepted when the app expects "__Host-session"
    expect((await call("GET", "/me", "session=anything")).status).toBe(401);
  });
});

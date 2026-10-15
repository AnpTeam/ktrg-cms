import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import type { AuthUser } from "../auth/otp-service";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { MailMessage } from "../lib/mailer";
import { createMemoryMeStore } from "./me-memory-store";
import { meRoutes } from "./me-routes";
import { createMeService } from "./me-service";

const alice: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "participant", locale: "ja" };
const bob: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "bob@example.com", role: "participant", locale: "en" };

type MeBody = {
  ok: true;
  me: {
    id: string;
    email: string | null;
    role: string;
    locale: string;
    displayName: string | null;
    deletionRequestedAt: string | null;
    createdAt: string;
  };
};

function setup() {
  const users = new Map<string, AuthUser>([
    [alice.id, { ...alice }],
    [bob.id, { ...bob }],
  ]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const mem = createMemoryMeStore(users);
  const sent: MailMessage[] = [];
  const me = createMeService({
    store: mem.store,
    mailer: {
      async send(m) {
        sent.push(m);
      },
    },
  });
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const app = new Elysia({ prefix: "/api/v1" }).use(meRoutes(() => ({ me, session, rateLimit }), { secureCookies: false }));

  const call = (method: string, path: string, cookie?: string, body?: unknown) =>
    app.handle(
      new Request(`http://localhost/api/v1/me${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const login = async (user: AuthUser) => `session=${(await session.create(users.get(user.id)!)).token}`;
  return { call, login, users, sent, audit: mem.audit, session };
}

describe("every /me route needs a login", () => {
  test("401 without a session", async () => {
    const { call } = setup();
    for (const [method, path, body] of [
      ["GET", "", undefined],
      ["PATCH", "", { locale: "en" }],
      ["DELETE", "", undefined],
      ["POST", "/deletion/cancel", undefined],
    ] as const) {
      const res = await call(method, path, undefined, body);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: "unauthenticated" });
    }
  });
});

describe("GET /me", () => {
  test("returns the caller's own profile, and only theirs", async () => {
    const { call, login } = setup();
    const res = await call("GET", "", await login(alice));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MeBody;
    expect(body.me).toMatchObject({
      id: alice.id,
      email: "alice@example.com",
      role: "participant",
      locale: "ja",
      displayName: null,
      deletionRequestedAt: null,
    });
    expect(new Date(body.me.createdAt).toString()).not.toBe("Invalid Date");
    expect(((await (await call("GET", "", await login(bob))).json()) as MeBody).me.id).toBe(bob.id);
  });
});

describe("PATCH /me", () => {
  test("changes the language and display name, and returns the new profile", async () => {
    const { call, login } = setup();
    const cookie = await login(alice);
    const res = await call("PATCH", "", cookie, { locale: "en", displayName: "  Alice  " });
    expect(res.status).toBe(200);
    expect(((await res.json()) as MeBody).me).toMatchObject({ locale: "en", displayName: "Alice" });
    expect(((await (await call("GET", "", cookie)).json()) as MeBody).me).toMatchObject({ locale: "en", displayName: "Alice" });
  });

  test("the new language is what the session reports straight away", async () => {
    const { call, login, session } = setup();
    const cookie = await login(alice);
    await call("PATCH", "", cookie, { locale: "en" });
    expect((await session.authenticate(cookie.slice("session=".length)))!.user.locale).toBe("en");
  });

  test("one field at a time leaves the other alone; null clears the name", async () => {
    const { call, login } = setup();
    const cookie = await login(alice);
    await call("PATCH", "", cookie, { displayName: "Alice" });
    expect(((await (await call("PATCH", "", cookie, { locale: "en" })).json()) as MeBody).me.displayName).toBe("Alice");
    expect(((await (await call("PATCH", "", cookie, { displayName: null })).json()) as MeBody).me.displayName).toBeNull();
  });

  test("a name that is too long or hides characters: 400, nothing changes", async () => {
    const { call, login } = setup();
    const cookie = await login(alice);
    for (const displayName of ["x".repeat(41), "evil‮txt.exe"]) {
      const res = await call("PATCH", "", cookie, { locale: "en", displayName });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "invalid_display_name" });
    }
    expect(((await (await call("GET", "", cookie)).json()) as MeBody).me.locale).toBe("ja");
  });

  test("email and role cannot be changed here: alone they are 422, next to a real field they are dropped", async () => {
    const { call, login } = setup();
    const cookie = await login(alice);
    for (const body of [{ email: "evil@example.com" }, { role: "admin" }, { locale: "fr" }, {}]) {
      expect((await call("PATCH", "", cookie, body)).status).toBe(422);
    }
    // Elysia strips unknown fields when valid ones are present: the role is never applied.
    const res = await call("PATCH", "", cookie, { locale: "en", role: "admin", email: "evil@example.com" });
    expect(res.status).toBe(200);
    expect(((await (await call("GET", "", cookie)).json()) as MeBody).me).toMatchObject({
      email: "alice@example.com",
      role: "participant",
      locale: "en",
    });
  });
});

describe("DELETE /me (deletion request) and POST /me/deletion/cancel", () => {
  test("DELETE records a request (202), emails the owner and audits it; nothing is deleted", async () => {
    const { call, login, users, sent, audit } = setup();
    const cookie = await login(alice);
    const res = await call("DELETE", "", cookie);

    expect(res.status).toBe(202);
    const { me } = (await res.json()) as MeBody;
    expect(me.deletionRequestedAt).not.toBeNull();
    expect(users.has(alice.id)).toBe(true);
    expect((await call("GET", "", cookie)).status).toBe(200); // still logged in, still there
    expect(sent.map((m) => m.subject)).toEqual(["【KTRG】アカウント削除のリクエストを受け付けました"]);
    expect(audit).toEqual([{ actorUserId: alice.id, action: "user.deletion_request", targetType: "user", targetId: alice.id }]);
  });

  test("asking twice keeps the first time and sends one email", async () => {
    const { call, login, sent, audit } = setup();
    const cookie = await login(alice);
    const first = ((await (await call("DELETE", "", cookie)).json()) as MeBody).me.deletionRequestedAt;
    const again = await call("DELETE", "", cookie);
    expect(again.status).toBe(202);
    expect(((await again.json()) as MeBody).me.deletionRequestedAt).toBe(first);
    expect(sent).toHaveLength(1);
    expect(audit).toHaveLength(1);
  });

  test("cancel clears the request", async () => {
    const { call, login, audit } = setup();
    const cookie = await login(alice);
    await call("DELETE", "", cookie);
    const res = await call("POST", "/deletion/cancel", cookie);
    expect(res.status).toBe(200);
    expect(((await res.json()) as MeBody).me.deletionRequestedAt).toBeNull();
    expect(audit.map((r) => r.action)).toEqual(["user.deletion_request", "user.deletion_cancel"]);
  });

  test("one account's request does not touch another's", async () => {
    const { call, login } = setup();
    await call("DELETE", "", await login(alice));
    expect(((await (await call("GET", "", await login(bob))).json()) as MeBody).me.deletionRequestedAt).toBeNull();
  });

  test("a request/cancel loop is capped, so it cannot flood the owner's inbox: 429", async () => {
    const { call, login, sent } = setup();
    const cookie = await login(alice);
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await call("DELETE", "", cookie)).status);
      statuses.push((await call("POST", "/deletion/cancel", cookie)).status);
    }
    expect(statuses).toEqual([202, 200, 202, 200, 202, 429, 429, 429]);
    expect(sent).toHaveLength(3);
  });
});

import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import type { MailMessage } from "../lib/mailer";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { passkeyRoutes } from "./passkey-routes";
import { createPasskeyService } from "./passkey-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const testProfile = { displayName: "Hiker", origin: null, locale: "ja" } as const;

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };
const bob: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "bob@example.com", role: "participant", locale: "en" };

function setup() {
  const users = new Map<string, AuthUser>([
    [alice.id, alice],
    [bob.id, bob],
  ]);
  const sessions = createMemorySessionStore(users);
  const session = createSessionService({ store: sessions.store });
  const mem = createMemoryPasskeyStore(users);
  const sent: MailMessage[] = [];
  const passkeys = createPasskeyService({
    store: mem.store,
    config,
    mailer: {
      async send(m) {
        sent.push(m);
      },
    },
  });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32) });
  const app = new Elysia({ prefix: "/api/v1" }).use(
    passkeyRoutes(() => ({ passkeys, session, rateLimit, audit: audit.writer }), { secureCookies: false }),
  );

  const call = (method: string, path: string, body?: unknown, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/passkeys${path}`, {
        method,
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const cookieFor = async (user: AuthUser) => `session=${(await session.create(user)).token}`;

  async function addPasskey(user: AuthUser, label: string | null) {
    const r = await passkeys.registrationOptions(user);
    if (!r.ok) throw new Error("options refused");
    const phone = new TestAuthenticator({ origin: config.origin, rpId: config.rpId });
    await passkeys.verifyRegistration(user, phone.register(r.options), label);
  }

  return { call, cookieFor, addPasskey, service: passkeys, sent, session, auditRows: audit.rows };
}

type ListBody = { ok: boolean; passkeys: { id: string; label: string | null; createdAt: string }[] };

describe("GET /auth/passkeys", () => {
  test("needs a login", async () => {
    const { call } = setup();
    expect((await call("GET", "/")).status).toBe(401);
    expect((await call("GET", "/", undefined, "session=not-real")).status).toBe(401);
  });

  test("lists the caller's own passkeys and nobody else's", async () => {
    const { call, cookieFor, addPasskey } = setup();
    await addPasskey(alice, "My iPhone");
    await addPasskey(bob, "Bob's phone");

    const res = await call("GET", "/", undefined, await cookieFor(alice));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(body.passkeys.map((p) => p.label)).toEqual(["My iPhone"]);
    expect(Object.keys(body.passkeys[0]!).sort()).toEqual(["createdAt", "id", "label"]);
  });
});

describe("PATCH /auth/passkeys/:id", () => {
  test("needs a login", async () => {
    const { call } = setup();
    expect((await call("PATCH", "/33333333-3333-3333-3333-333333333333", { label: "x" })).status).toBe(401);
  });

  test("renames your own passkey and records it", async () => {
    const { call, cookieFor, addPasskey, auditRows } = setup();
    await addPasskey(alice, "iPhone · Safari");
    const cookie = await cookieFor(alice);
    const id = ((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys[0]!.id;

    const res = await call("PATCH", `/${id}`, { label: "  My phone  " }, cookie);

    expect(res.status).toBe(200);
    expect(((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys[0]!.label).toBe("My phone");
    expect(auditRows).toEqual([{ actorUserId: alice.id, action: "passkey.rename", targetType: "passkey", targetId: id }]);
  });

  test("an empty name is refused", async () => {
    const { call, cookieFor, addPasskey } = setup();
    await addPasskey(alice, "Old");
    const cookie = await cookieFor(alice);
    const id = ((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys[0]!.id;
    expect((await call("PATCH", `/${id}`, { label: "   " }, cookie)).status).toBe(400);
  });

  test("someone else's passkey looks like one that does not exist, and stays as it was", async () => {
    const { call, cookieFor, addPasskey, auditRows } = setup();
    await addPasskey(alice, "Alice's");
    const aliceId = ((await (await call("GET", "/", undefined, await cookieFor(alice))).json()) as ListBody).passkeys[0]!.id;

    const res = await call("PATCH", `/${aliceId}`, { label: "Hacked" }, await cookieFor(bob));

    expect(res.status).toBe(404);
    expect(((await (await call("GET", "/", undefined, await cookieFor(alice))).json()) as ListBody).passkeys[0]!.label).toBe("Alice's");
    expect(auditRows).toEqual([]);
  });
});

describe("DELETE /auth/passkeys/:id", () => {
  test("needs a login", async () => {
    const { call } = setup();
    expect((await call("DELETE", "/33333333-3333-3333-3333-333333333333")).status).toBe(401);
  });

  test("removes your own passkey and emails you", async () => {
    const { call, cookieFor, addPasskey, sent, auditRows } = setup();
    await addPasskey(alice, "Old laptop");
    sent.length = 0;
    const cookie = await cookieFor(alice);
    const id = ((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys[0]!.id;

    const res = await call("DELETE", `/${id}`, undefined, cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("removed");
    expect(auditRows).toEqual([{ actorUserId: alice.id, action: "passkey.remove", targetType: "passkey", targetId: id }]);
  });

  test("removing a passkey signs out the account's other devices, and this one stays in", async () => {
    const { call, cookieFor, addPasskey } = setup();
    await addPasskey(alice, "Lost phone");
    const here = await cookieFor(alice);
    const stolen = await cookieFor(alice);
    const id = ((await (await call("GET", "/", undefined, here)).json()) as ListBody).passkeys[0]!.id;

    expect((await call("DELETE", `/${id}`, undefined, here)).status).toBe(200);

    expect((await call("GET", "/", undefined, stolen)).status).toBe(401);
    expect((await call("GET", "/", undefined, here)).status).toBe(200);
  });

  test("someone else's passkey is a plain 404 and stays", async () => {
    const { call, cookieFor, addPasskey, sent, auditRows } = setup();
    await addPasskey(bob, "Bob's phone");
    sent.length = 0;
    const bobsId = ((await (await call("GET", "/", undefined, await cookieFor(bob))).json()) as ListBody).passkeys[0]!.id;

    const res = await call("DELETE", `/${bobsId}`, undefined, await cookieFor(alice));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "not_found" });
    expect(((await (await call("GET", "/", undefined, await cookieFor(bob))).json()) as ListBody).passkeys).toHaveLength(1);
    expect(sent).toHaveLength(0);
    expect(auditRows).toEqual([]); // nothing was removed, so nothing is recorded
  });

  test("a made-up id is 404, and a malformed id is rejected before anything runs", async () => {
    const { call, cookieFor } = setup();
    const cookie = await cookieFor(alice);
    expect((await call("DELETE", "/33333333-3333-3333-3333-333333333333", undefined, cookie)).status).toBe(404);
    expect((await call("DELETE", "/not-an-id", undefined, cookie)).status).toBe(422);
    expect((await call("DELETE", "/'; DROP TABLE passkeys;--", undefined, cookie)).status).toBe(422);
  });

  test("a passkey-only account cannot remove its last passkey: 409", async () => {
    const { call, service, session } = setup();
    const phone = new TestAuthenticator({ origin: config.origin, rpId: config.rpId });
    const signup = await service.verifySignup(phone.register(await service.signupOptions()), "only", testProfile);
    if (!signup.ok) throw new Error("sign-up failed");
    const cookie = `session=${(await session.create(signup.user)).token}`;
    const id = ((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys[0]!.id;

    const res = await call("DELETE", `/${id}`, undefined, cookie);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "last_login_method" });
    expect(((await (await call("GET", "/", undefined, cookie)).json()) as ListBody).passkeys).toHaveLength(1);
  });

  test("more than 10 removal attempts in 15 minutes gets 429", async () => {
    const { call, cookieFor } = setup();
    const cookie = await cookieFor(alice);
    for (let i = 0; i < 10; i++) {
      expect((await call("DELETE", "/33333333-3333-3333-3333-333333333333", undefined, cookie)).status).toBe(404);
    }
    const res = await call("DELETE", "/33333333-3333-3333-3333-333333333333", undefined, cookie);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

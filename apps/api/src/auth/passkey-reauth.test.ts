import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryMeStore } from "../me/me-memory-store";
import { meRoutes } from "../me/me-routes";
import { createMeService } from "../me/me-service";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { passkeyRoutes } from "./passkey-routes";
import { createPasskeyService } from "./passkey-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { FRESH_LOGIN_MS } from "./session";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };
const bob: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "bob@example.com", role: "participant", locale: "en" };

function setup() {
  const users = new Map<string, AuthUser>([
    [alice.id, { ...alice }],
    [bob.id, { ...bob }],
  ]);
  let clock = new Date("2026-10-17T00:00:00Z");
  const now = () => clock;
  const session = createSessionService({ store: createMemorySessionStore(users).store, now });
  const mem = createMemoryPasskeyStore(users);
  const passkeys = createPasskeyService({ store: mem.store, config, now });
  const meMem = createMemoryMeStore(users);
  const me = createMeService({ store: meMem.store, mailer: { async send() {} } });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32) });
  const services = () => ({ passkeys, session, rateLimit, audit: audit.writer, me });
  const app = new Elysia({ prefix: "/api/v1" })
    .use(passkeyRoutes(services, { secureCookies: false }))
    .use(meRoutes(services, { secureCookies: false }));

  const call = (method: string, path: string, body?: unknown, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const cookieFor = async (user: AuthUser) => `session=${(await session.create(user)).token}`;

  async function addPasskey(user: AuthUser) {
    const r = await passkeys.registrationOptions(user);
    if (!r.ok) throw new Error("options refused");
    const phone = new TestAuthenticator({ origin: config.origin, rpId: config.rpId });
    const added = await passkeys.verifyRegistration(user, phone.register(r.options), "phone");
    if (!added.ok) throw new Error("registration failed");
    return { phone, id: added.passkey.id };
  }

  return { call, cookieFor, addPasskey, passkeys, auditRows: audit.rows, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("passkey fresh-login check (service)", () => {
  test("offers only the account's own passkeys, and nothing when it has none", async () => {
    const { passkeys, addPasskey } = setup();
    expect(await passkeys.reauthOptions(alice)).toBeNull();
    const { phone } = await addPasskey(alice);
    await addPasskey(bob);
    const options = await passkeys.reauthOptions(alice);
    expect(options?.allowCredentials?.map((c) => c.id)).toEqual([phone.id]);
    expect(options?.userVerification).toBe("required");
  });

  test("the account's own phone passes; the challenge works once", async () => {
    const { passkeys, addPasskey } = setup();
    const { phone } = await addPasskey(alice);
    const options = await passkeys.reauthOptions(alice);
    const response = phone.authenticate(options!);
    expect(await passkeys.verifyReauth(alice, response)).toBe(true);
    expect(await passkeys.verifyReauth(alice, response)).toBe(false);
  });

  test("someone else's passkey never counts, even with a valid signature", async () => {
    const { passkeys, addPasskey } = setup();
    await addPasskey(alice);
    const { phone: bobsPhone } = await addPasskey(bob);
    const options = await passkeys.reauthOptions(alice);
    expect(await passkeys.verifyReauth(alice, bobsPhone.authenticate(options!))).toBe(false);
  });

  test("a login challenge (nobody's) cannot be used for the re-check", async () => {
    const { passkeys, addPasskey } = setup();
    const { phone } = await addPasskey(alice);
    const loginOptions = await passkeys.loginOptions();
    expect(await passkeys.verifyReauth(alice, phone.authenticate(loginOptions))).toBe(false);
  });
});

describe("sensitive actions need a fresh login", () => {
  test("a fresh session (just logged in) may add and remove a passkey", async () => {
    const { call, cookieFor } = setup();
    const cookie = await cookieFor(alice);
    expect((await call("POST", "/auth/passkeys/register/options", undefined, cookie)).status).toBe(200);
  });

  test("an old session is refused until it proves it is the owner again", async () => {
    const { call, cookieFor, addPasskey, advance, auditRows } = setup();
    const { phone, id } = await addPasskey(alice);
    const cookie = await cookieFor(alice);
    advance(FRESH_LOGIN_MS + 1000);

    // Adding, removing and asking for deletion are all refused...
    for (const [method, path] of [
      ["POST", "/auth/passkeys/register/options"],
      ["DELETE", `/auth/passkeys/${id}`],
      ["DELETE", "/me"],
    ] as const) {
      const res = await call(method, path, undefined, cookie);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: "reauth_required" });
    }
    // ...but reading is not.
    expect((await call("GET", "/auth/passkeys", undefined, cookie)).status).toBe(200);

    // Prove it with the phone's face, fingerprint or lock code.
    const optionsRes = await call("POST", "/auth/passkeys/reauth/options", undefined, cookie);
    expect(optionsRes.status).toBe(200);
    const { options } = (await optionsRes.json()) as { options: { challenge: string } };
    const verify = await call("POST", "/auth/passkeys/reauth/verify", { response: phone.authenticate(options) }, cookie);
    expect(verify.status).toBe(200);
    expect(auditRows.some((r) => r.action === "session.reauth")).toBe(true);

    // Now the sensitive action goes through.
    expect((await call("POST", "/auth/passkeys/register/options", undefined, cookie)).status).toBe(200);
    expect((await call("DELETE", "/me", undefined, cookie)).status).toBe(202);
  });

  test("a wrong or foreign passkey does not make the session fresh", async () => {
    const { call, cookieFor, addPasskey, advance } = setup();
    await addPasskey(alice);
    const { phone: bobsPhone } = await addPasskey(bob);
    const cookie = await cookieFor(alice);
    advance(FRESH_LOGIN_MS + 1000);

    const { options } = (await (await call("POST", "/auth/passkeys/reauth/options", undefined, cookie)).json()) as { options: { challenge: string } };
    const verify = await call("POST", "/auth/passkeys/reauth/verify", { response: bobsPhone.authenticate(options) }, cookie);
    expect(verify.status).toBe(400);
    expect(await verify.json()).toEqual({ ok: false, error: "reauth_failed" });
    expect((await call("POST", "/auth/passkeys/register/options", undefined, cookie)).status).toBe(403);
  });

  test("an account with no passkey is told to use the emailed code", async () => {
    const { call, cookieFor } = setup();
    const res = await call("POST", "/auth/passkeys/reauth/options", undefined, await cookieFor(alice));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "no_passkey" });
  });

  test("the re-check itself needs a login", async () => {
    const { call } = setup();
    expect((await call("POST", "/auth/passkeys/reauth/options")).status).toBe(401);
    const response = new TestAuthenticator({ origin: config.origin, rpId: config.rpId }).authenticate({ challenge: "x".repeat(43) });
    expect((await call("POST", "/auth/passkeys/reauth/verify", { response })).status).toBe(401);
  });
});

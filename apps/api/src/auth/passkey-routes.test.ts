import { describe, expect, test } from "bun:test";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import type { AuthUser } from "./otp-service";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { passkeyRoutes } from "./passkey-routes";
import { createPasskeyService } from "./passkey-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "ja" };

function setup() {
  const users = new Map<string, AuthUser>([[alice.id, alice]]);
  const sessions = createMemorySessionStore(users);
  const session = createSessionService({ store: sessions.store });
  const mem = createMemoryPasskeyStore();
  const passkeys = createPasskeyService({ store: mem.store, config });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32) });
  const app = new Elysia({ prefix: "/api/v1" }).use(
    passkeyRoutes(() => ({ passkeys, session, rateLimit, audit: audit.writer }), { secureCookies: false }),
  );

  const post = (path: string, body?: unknown, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/passkeys/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const loginCookie = async () => `session=${(await session.create(alice)).token}`;
  const phone = () => new TestAuthenticator({ origin: config.origin, rpId: config.rpId });

  return { post, loginCookie, phone, ...mem, auditRows: audit.rows };
}

async function getOptions(post: ReturnType<typeof setup>["post"], cookie: string) {
  const res = await post("register/options", undefined, cookie);
  const body = (await res.json()) as { ok: boolean; options: PublicKeyCredentialCreationOptionsJSON };
  return { res, options: body.options };
}

describe("passkey registration over HTTP", () => {
  test("the full flow: options, then verify, stores the passkey", async () => {
    const { post, loginCookie, phone, passkeys, auditRows } = setup();
    const cookie = await loginCookie();
    const p = phone();

    const { res, options } = await getOptions(post, cookie);
    expect(res.status).toBe(200);
    expect(options.rp.id).toBe("example.com");

    const verify = await post("register/verify", { response: p.register(options), label: "  My iPhone  " }, cookie);
    expect(verify.status).toBe(200);
    expect(await verify.json()).toEqual({ ok: true, passkey: { id: passkeys[0]!.id, credentialId: p.id, label: "My iPhone" } });
    expect(passkeys).toHaveLength(1);
    // Ids only: the label "My iPhone" is not in the audit log.
    expect(auditRows).toEqual([{ actorUserId: alice.id, action: "passkey.add", targetType: "passkey", targetId: passkeys[0]!.id }]);
  });

  test("both steps need a login", async () => {
    const { post, phone } = setup();
    expect((await post("register/options")).status).toBe(401);
    expect((await post("register/options", undefined, "session=not-real")).status).toBe(401);

    const response = phone().register({ challenge: "x".repeat(43) });
    expect((await post("register/verify", { response })).status).toBe(401);
  });

  test("a wrong or replayed response is a plain 400 with no detail", async () => {
    const { post, loginCookie, phone } = setup();
    const cookie = await loginCookie();
    const { options } = await getOptions(post, cookie);
    const response = phone().register(options, { origin: "https://evil.example.net" });

    const res = await post("register/verify", { response }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "registration_failed" });
  });

  test("a malformed body is rejected before any checking", async () => {
    const { post, loginCookie } = setup();
    const cookie = await loginCookie();
    expect((await post("register/verify", {}, cookie)).status).toBe(422);
    expect((await post("register/verify", { response: { id: "x" } }, cookie)).status).toBe(422);
  });

  test("a label over 64 characters is rejected", async () => {
    const { post, loginCookie, phone } = setup();
    const cookie = await loginCookie();
    const { options } = await getOptions(post, cookie);
    const res = await post("register/verify", { response: phone().register(options), label: "x".repeat(65) }, cookie);
    expect(res.status).toBe(422);
  });

  test("asking for options more than 10 times in 15 minutes gets 429", async () => {
    const { post, loginCookie } = setup();
    const cookie = await loginCookie();
    for (let i = 0; i < 10; i++) expect((await post("register/options", undefined, cookie)).status).toBe(200);

    const res = await post("register/options", undefined, cookie);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

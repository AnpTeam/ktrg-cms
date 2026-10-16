import { describe, expect, test } from "bun:test";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { passkeyRoutes } from "./passkey-routes";
import { createPasskeyService } from "./passkey-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };

function setup() {
  const users = new Map<string, AuthUser>();
  const sessions = createMemorySessionStore(users);
  const session = createSessionService({ store: sessions.store });
  const mem = createMemoryPasskeyStore(users);
  const passkeys = createPasskeyService({ store: mem.store, config });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32) });
  const app = new Elysia({ prefix: "/api/v1" }).use(
    passkeyRoutes(() => ({ passkeys, session, rateLimit, audit: audit.writer }), { secureCookies: false }),
  );

  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/passkeys/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const phone = () => new TestAuthenticator({ origin: config.origin, rpId: config.rpId });

  async function signUp(p = phone()) {
    const opt = (await (await post("signup/options")).json()) as { options: PublicKeyCredentialCreationOptionsJSON };
    const res = await post("signup/verify", { response: p.register(opt.options), label: "My iPhone", profile: { displayName: "Hana", origin: "nara", locale: "en" } });
    return { res, phone: p };
  }
  async function loginOptions() {
    const res = await post("login/options");
    return { res, options: ((await res.json()) as { options: PublicKeyCredentialRequestOptionsJSON }).options };
  }

  return { post, phone, signUp, loginOptions, session, ...mem };
}

/** The token inside a Set-Cookie header. */
const tokenOf = (setCookie: string | null) => /^session=([^;]+)/.exec(setCookie ?? "")?.[1];

describe("sign up with a passkey over HTTP", () => {
  test("creates an account with no email and logs it in", async () => {
    const { signUp, session } = setup();
    const { res } = await signUp();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user: AuthUser };
    expect(body.ok).toBe(true);
    expect(body.user).toMatchObject({ email: null, role: "participant", locale: "en" });

    // The cookie is a real, persistent session for the new account.
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/Max-Age=\d+/);
    const auth = await session.authenticate(tokenOf(setCookie)!);
    expect(auth?.user.id).toBe(body.user.id);
  });

  test("needs no login to start", async () => {
    const { post } = setup();
    const res = await post("signup/options");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });

  test("a bad registration is a plain 400 and sets no cookie", async () => {
    const { post, phone } = setup();
    const opt = (await (await post("signup/options")).json()) as { options: PublicKeyCredentialCreationOptionsJSON };
    const res = await post("signup/verify", {
      response: phone().register(opt.options, { origin: "https://evil.example.net" }),
      profile: { displayName: "Hana" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "registration_failed" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("sign-up needs a usable name, checked before the passkey is spent", async () => {
    const { post, phone } = setup();
    const opt = (await (await post("signup/options")).json()) as { options: PublicKeyCredentialCreationOptionsJSON };
    const response = phone().register(opt.options);
    for (const displayName of ["", "   ", "x".repeat(41), "a‮b"]) {
      const bad = await post("signup/verify", { response, profile: { displayName } });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toEqual({ ok: false, error: "invalid_display_name" });
    }
    // The challenge was not used up by the rejected tries.
    const good = await post("signup/verify", { response, profile: { displayName: "Hana" } });
    expect(good.status).toBe(200);
  });

  test("sign-up without a profile, or with an unknown origin, is rejected", async () => {
    const { post } = setup();
    expect((await post("signup/verify", { response: { id: "x" } })).status).toBe(422);
    const opt = (await (await post("signup/options")).json()) as { options: PublicKeyCredentialCreationOptionsJSON };
    const response = new TestAuthenticator({ origin: config.origin, rpId: config.rpId }).register(opt.options);
    expect((await post("signup/verify", { response, profile: { displayName: "Hana", origin: "mars" } })).status).toBe(422);
  });

  test("a malformed body is rejected", async () => {
    const { post } = setup();
    expect((await post("signup/verify", {})).status).toBe(422);
    expect((await post("signup/verify", { response: { id: "x" } })).status).toBe(422);
  });

  test("the 31st sign-up request from one IP in 15 minutes gets 429", async () => {
    const { post } = setup();
    for (let i = 0; i < 30; i++) expect((await post("signup/options")).status).toBe(200);
    const res = await post("signup/options");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("log in with a passkey over HTTP", () => {
  test("a passkey-only account logs in and gets a session", async () => {
    const { signUp, loginOptions, post, session } = setup();
    const { phone } = await signUp();

    const { options } = await loginOptions();
    const res = await post("login/verify", { response: phone.authenticate(options) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user: AuthUser };
    expect(body.user.email).toBeNull();
    const auth = await session.authenticate(tokenOf(res.headers.get("set-cookie"))!);
    expect(auth?.user.id).toBe(body.user.id);
  });

  test("login options need no login and no email", async () => {
    const { loginOptions } = setup();
    const { res, options } = await loginOptions();
    expect(res.status).toBe(200);
    expect(options.rpId).toBe("example.com");
    expect(options.allowCredentials ?? []).toEqual([]);
  });

  test("every kind of failure is the same 401 with no cookie", async () => {
    const { signUp, loginOptions, post, phone: newPhone } = setup();
    const { phone } = await signUp();

    const unknown = await post("login/verify", { response: newPhone().authenticate((await loginOptions()).options) });
    const forged = await post("login/verify", {
      response: phone.authenticate((await loginOptions()).options, { signWithOtherKey: true }),
    });

    for (const res of [unknown, forged]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: "login_failed" });
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  test("a replayed login is rejected", async () => {
    const { signUp, loginOptions, post } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate((await loginOptions()).options);

    expect((await post("login/verify", { response })).status).toBe(200);
    expect((await post("login/verify", { response })).status).toBe(401);
  });

  test("accepts a null userHandle, as some browsers send", async () => {
    const { signUp, loginOptions, post } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate((await loginOptions()).options);
    (response.response as { userHandle?: string | null }).userHandle = null;

    // Valid shape; the passkey itself is still genuine, so it logs in.
    expect((await post("login/verify", { response })).status).toBe(200);
  });

  test("a malformed body is rejected", async () => {
    const { post } = setup();
    expect((await post("login/verify", {})).status).toBe(422);
    expect((await post("login/verify", { response: { id: "x" } })).status).toBe(422);
  });

  test("the 31st login request from one IP in 15 minutes gets 429", async () => {
    const { post } = setup();
    for (let i = 0; i < 30; i++) expect((await post("login/options")).status).toBe(200);
    expect((await post("login/options")).status).toBe(429);
  });
});

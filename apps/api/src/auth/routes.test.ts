import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryOtpStore } from "./otp-memory-store";
import { createOtpService } from "./otp-service";
import { authRoutes } from "./routes";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";

function setup(opts: { secureCookies?: boolean } = {}) {
  const { store, users } = createMemoryOtpStore();
  const sessions = createMemorySessionStore(users);
  const codes: string[] = [];
  const otp = createOtpService({
    secret: "r".repeat(32),
    store,
    mailer: {
      async send(m) {
        codes.push(m.text.match(/\d{6}/)![0]);
      },
    },
  });
  const session = createSessionService({ store: sessions.store });
  const app = new Elysia({ prefix: "/api/v1" }).use(
    authRoutes(() => ({ otp, session }), { secureCookies: opts.secureCookies ?? false }),
  );

  const post = (path: string, body?: unknown, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const get = (path: string, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/${path}`, { headers: cookie ? { cookie } : {} }),
    );

  /** Request a code, verify it, and return the response plus the cookie to send back. */
  async function login(emailAddress = "a@example.com") {
    await post("otp/request", { email: emailAddress });
    const res = await post("otp/verify", { email: emailAddress, code: codes.at(-1) });
    const setCookie = res.headers.get("set-cookie") ?? "";
    return { res, setCookie, cookie: setCookie.split(";")[0]! };
  }

  return { post, get, login, codes, users, sessions };
}

describe("POST /auth/otp/request", () => {
  test("returns the identical response for a sent and a throttled request", async () => {
    const { post, codes } = setup();

    const first = await post("otp/request", { email: "a@example.com" });
    const second = await post("otp/request", { email: "a@example.com" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(codes).toHaveLength(1);
  });

  test("rejects a missing or malformed email", async () => {
    const { post } = setup();
    expect((await post("otp/request", {})).status).toBe(422);
    expect((await post("otp/request", { email: "not-an-email" })).status).toBe(422);
    expect((await post("otp/request", { email: "a".repeat(250) + "@x.com" })).status).toBe(422);
  });
});

describe("POST /auth/otp/verify", () => {
  test("the right code returns the user", async () => {
    const { login } = setup();
    const { res } = await login();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user: { email: string; role: string } };
    expect(body.ok).toBe(true);
    expect(body.user).toMatchObject({ email: "a@example.com", role: "participant" });
  });

  test("every kind of failure gets the same 401 answer", async () => {
    const { post, codes } = setup();
    await post("otp/request", { email: "a@example.com" });
    const wrong = codes[0] === "000000" ? "111111" : "000000";

    const wrongCode = await post("otp/verify", { email: "a@example.com", code: wrong });
    const unknownEmail = await post("otp/verify", { email: "nobody@example.com", code: wrong });

    expect(wrongCode.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await unknownEmail.json()).toEqual(await wrongCode.json());
    expect(wrongCode.headers.get("set-cookie")).toBeNull();
  });

  test("a used code is rejected", async () => {
    const { post, login, codes } = setup();
    await login();
    expect((await post("otp/verify", { email: "a@example.com", code: codes[0] })).status).toBe(401);
  });

  test("rejects a malformed code before looking anything up", async () => {
    const { post } = setup();
    expect((await post("otp/verify", { email: "a@example.com", code: "12345" })).status).toBe(422);
    expect((await post("otp/verify", { email: "a@example.com", code: "abcdef" })).status).toBe(422);
    expect((await post("otp/verify", { email: "a@example.com" })).status).toBe(422);
  });
});

describe("session cookie", () => {
  test("login sets a persistent, HttpOnly, SameSite=Lax cookie", async () => {
    const { setCookie } = await setup().login();

    expect(setCookie).toMatch(/^session=[A-Za-z0-9_-]{43};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    // Max-Age makes it persistent: it survives closing the app on iPhone.
    const maxAge = Number(setCookie.match(/Max-Age=(\d+)/)![1]);
    expect(maxAge).toBeGreaterThan(364 * 24 * 3600);
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).not.toContain("Domain");
  });

  test("in production the cookie is __Host- prefixed and Secure", async () => {
    const { setCookie } = await setup({ secureCookies: true }).login();

    expect(setCookie).toMatch(/^__Host-session=/);
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Domain");
  });

  test("the database never holds the token, only its hash", async () => {
    const { login, sessions } = setup();
    const { cookie } = await login();
    const token = cookie.split("=")[1]!;

    expect(sessions.rows).toHaveLength(1);
    expect(sessions.rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessions.rows[0]!.tokenHash).not.toContain(token);
  });

  test("GET /auth/session returns the user for a valid cookie", async () => {
    const { get, login } = setup();
    const { cookie } = await login();

    const res = await get("session", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, user: { email: "a@example.com" } });
  });

  test("GET /auth/session is 401 with no cookie or a made-up one", async () => {
    const { get } = setup();
    expect((await get("session")).status).toBe(401);
    expect((await get("session", "session=not-a-real-token")).status).toBe(401);
  });

  test("logout ends the session and clears the cookie", async () => {
    const { get, post, login, sessions } = setup();
    const { cookie } = await login();

    const out = await post("logout", undefined, cookie);
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(sessions.rows).toHaveLength(0);

    expect((await get("session", cookie)).status).toBe(401);
  });

  test("logout without a session still succeeds", async () => {
    const { post } = setup();
    expect((await post("logout")).status).toBe(200);
  });
});

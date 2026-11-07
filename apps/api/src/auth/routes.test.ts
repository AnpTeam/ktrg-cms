import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryOtpStore } from "./otp-memory-store";
import { createOtpService } from "./otp-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { authRoutes } from "./routes";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";

function setup(opts: { secureCookies?: boolean; trustProxy?: boolean } = {}) {
  const { store, users, profiles: otpProfiles } = createMemoryOtpStore();
  const sessions = createMemorySessionStore(users);
  const codes: string[] = [];
  const subjects: string[] = [];
  let clock = new Date();
  const otp = createOtpService({
    secret: "r".repeat(32),
    store,
    mailer: {
      async send(m) {
        codes.push(m.text.match(/\d{6}/)![0]);
        subjects.push(m.subject);
      },
    },
    now: () => clock,
  });
  const session = createSessionService({ store: sessions.store });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "l".repeat(32) });
  const app = new Elysia({ prefix: "/api/v1" }).use(
    authRoutes(() => ({ otp, session, rateLimit, audit: audit.writer }), {
      secureCookies: opts.secureCookies ?? false,
      trustProxy: opts.trustProxy ?? false,
    }),
  );

  const post = (path: string, body?: unknown, cookie?: string, extraHeaders: Record<string, string> = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extraHeaders },
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

  return {
    post,
    get,
    login,
    auditRows: audit.rows,
    codes,
    subjects,
    users,
    otpProfiles,
    sessions,
    session,
    /** Moves only the OTP clock (codes, cooldown); sessions keep real time. */
    advanceOtp: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
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

  test("accepts ja or en as the email language and rejects anything else", async () => {
    const { post } = setup();
    expect((await post("otp/request", { email: "a@example.com", locale: "en" })).status).toBe(200);
    expect((await post("otp/request", { email: "b@example.com", locale: "ja" })).status).toBe(200);
    expect((await post("otp/request", { email: "c@example.com", locale: "fr" })).status).toBe(422);
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

  test("an admin's login and logout are recorded; a participant's are not", async () => {
    const t = setup();
    const first = await t.login(); // creates the account as a participant
    await t.post("logout", undefined, first.cookie);
    expect(t.auditRows).toEqual([]);

    const me = [...t.users.values()][0]!;
    me.role = "admin";
    t.advanceOtp(61_000); // past the 60 s resend cooldown, so a new code is sent
    const again = await t.login();
    await t.post("logout", undefined, again.cookie);
    expect(t.auditRows).toEqual([
      { actorUserId: me.id, action: "session.login", targetType: "user", targetId: me.id },
      { actorUserId: me.id, action: "session.logout", targetType: "user", targetId: me.id },
    ]);
  });
});

describe("POST /auth/session/rotate", () => {
  test("needs a session", async () => {
    expect((await setup().post("session/rotate")).status).toBe(401);
  });

  test("changes nothing until it is due", async () => {
    const t = setup();
    const { cookie } = await t.login();
    const res = await t.post("session/rotate", undefined, cookie);
    expect(await res.json()).toEqual({ ok: true, rotated: false });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("when due, gives the browser a new token that works, and the old one ends once it is used", async () => {
    const t = setup();
    const { cookie } = await t.login();
    t.sessions.rows[0]!.rotatedAt = new Date(Date.now() - 31 * 24 * 3600 * 1000);
    const res = await t.post("session/rotate", undefined, cookie);
    expect(await res.json()).toEqual({ ok: true, rotated: true });
    const next = res.headers.get("set-cookie")!.split(";")[0]!;
    expect(next).not.toBe(cookie);
    expect((await t.get("session", cookie)).status).toBe(200);
    expect((await t.get("session", next)).status).toBe(200);
    expect((await t.get("session", cookie)).status).toBe(200); // a slow request sent before the change
    t.sessions.rows[0]!.rotatedAt = new Date(Date.now() - 2 * 3600 * 1000);
    expect((await t.get("session", next)).status).toBe(200);
    expect((await t.get("session", cookie)).status).toBe(401);
    expect(await (await t.post("session/rotate", undefined, next)).json()).toEqual({ ok: true, rotated: false });
  });

  test("asking again straight after sets no second cookie: the old one stays good", async () => {
    const t = setup();
    const { cookie } = await t.login();
    t.sessions.rows[0]!.rotatedAt = new Date(Date.now() - 31 * 24 * 3600 * 1000);
    await t.post("session/rotate", undefined, cookie);
    const again = await t.post("session/rotate", undefined, cookie);
    expect(await again.json()).toEqual({ ok: true, rotated: false });
    expect(again.headers.get("set-cookie")).toBeNull();
    expect((await t.get("session", cookie)).status).toBe(200);
  });
});

describe("rate limits", () => {
  test("otp/request: the 6th request for one email in 15 minutes gets 429 with Retry-After", async () => {
    const { post } = setup();
    for (let i = 0; i < 5; i++) expect((await post("otp/request", { email: "a@example.com" })).status).toBe(200);

    const res = await post("otp/request", { email: "A@example.com" }); // case does not dodge it
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
    const wait = Number(res.headers.get("retry-after"));
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(15 * 60);
  });

  test("a blocked request sends no email", async () => {
    const { post, codes } = setup();
    for (let i = 0; i < 5; i++) await post("otp/request", { email: "a@example.com" });
    const before = codes.length;
    await post("otp/request", { email: "a@example.com" });
    expect(codes.length).toBe(before);
  });

  test("otp/request: one IP asking for many different emails is stopped at 20", async () => {
    const { post } = setup();
    for (let i = 0; i < 20; i++) {
      expect((await post("otp/request", { email: `user${i}@example.com` })).status).toBe(200);
    }
    expect((await post("otp/request", { email: "one-more@example.com" })).status).toBe(429);
  });

  test("otp/verify: guessing against one email is stopped at 10 in 15 minutes", async () => {
    const { post } = setup();
    await post("otp/request", { email: "a@example.com" });
    for (let i = 0; i < 10; i++) {
      expect((await post("otp/verify", { email: "a@example.com", code: "000000" })).status).not.toBe(429);
    }
    expect((await post("otp/verify", { email: "a@example.com", code: "000000" })).status).toBe(429);
  });

  test("otp/verify: even the right code is refused once the limit is hit", async () => {
    const { post, codes } = setup();
    await post("otp/request", { email: "a@example.com" });
    for (let i = 0; i < 10; i++) await post("otp/verify", { email: "a@example.com", code: "000000" });
    const res = await post("otp/verify", { email: "a@example.com", code: codes[0] });
    expect(res.status).toBe(429);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("a forged X-Forwarded-For does not dodge the IP limit when no proxy is trusted", async () => {
    const { post } = setup({ trustProxy: false });
    for (let i = 0; i < 20; i++) {
      await post("otp/request", { email: `u${i}@example.com` }, undefined, { "x-forwarded-for": `9.9.9.${i}` });
    }
    const res = await post("otp/request", { email: "x@example.com" }, undefined, { "x-forwarded-for": "1.2.3.4" });
    expect(res.status).toBe(429);
  });

  test("behind a trusted proxy, different clients get separate IP limits", async () => {
    const { post } = setup({ trustProxy: true });
    for (let i = 0; i < 20; i++) {
      await post("otp/request", { email: `u${i}@example.com` }, undefined, { "x-forwarded-for": "203.0.113.1" });
    }
    const blocked = await post("otp/request", { email: "x@example.com" }, undefined, { "x-forwarded-for": "203.0.113.1" });
    const other = await post("otp/request", { email: "y@example.com" }, undefined, { "x-forwarded-for": "203.0.113.2" });
    expect(blocked.status).toBe(429);
    expect(other.status).toBe(200);
  });

  test("one IP burning an address's limits does not lock the address's owner out from another IP", async () => {
    const { post, codes } = setup({ trustProxy: true });
    const from = (ip: string) => ({ "x-forwarded-for": ip });
    for (let i = 0; i < 6; i++) await post("otp/request", { email: "a@example.com" }, undefined, from("203.0.113.9"));
    for (let i = 0; i < 10; i++) await post("otp/verify", { email: "a@example.com", code: "000000" }, undefined, from("203.0.113.9"));
    expect((await post("otp/request", { email: "a@example.com" }, undefined, from("203.0.113.9"))).status).toBe(429);
    expect((await post("otp/verify", { email: "a@example.com", code: "000000" }, undefined, from("203.0.113.9"))).status).toBe(429);

    expect((await post("otp/request", { email: "a@example.com" }, undefined, from("198.51.100.7"))).status).toBe(200);
    expect((await post("otp/verify", { email: "a@example.com", code: "000000" }, undefined, from("198.51.100.7"))).status).toBe(401); // wrong code, but not 429
    void codes;
  });

  test("malformed requests are rejected before they count", async () => {
    const { post } = setup();
    for (let i = 0; i < 30; i++) await post("otp/request", { email: "not-an-email" });
    expect((await post("otp/request", { email: "a@example.com" })).status).toBe(200);
  });
});

describe("fresh login: POST /auth/reauth/request and /auth/reauth/verify", () => {
  /** Log in, then wait out the 60 s resend cooldown so a re-check code can be sent. */
  async function loggedIn(t: ReturnType<typeof setup>, emailAddress = "a@example.com") {
    const { cookie } = await t.login(emailAddress);
    t.advanceOtp(61_000);
    return cookie;
  }

  test("both steps need a login", async () => {
    const { post } = setup();
    expect((await post("reauth/request")).status).toBe(401);
    expect((await post("reauth/verify", { code: "123456" })).status).toBe(401);
  });

  test("request emails a confirmation code to the account's own address, in its language", async () => {
    const t = setup();
    const cookie = await loggedIn(t);
    const res = await t.post("reauth/request", undefined, cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(t.subjects.at(-1)).toBe("【葛城修験】本人確認の番号"); // new accounts are Japanese
  });

  test("the right code makes the session fresh for 10 minutes", async () => {
    const t = setup();
    const cookie = await loggedIn(t);
    await t.post("reauth/request", undefined, cookie);

    const before = Date.now();
    const res = await t.post("reauth/verify", { code: t.codes.at(-1) }, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; freshUntil: string };
    expect(body.ok).toBe(true);
    const until = new Date(body.freshUntil).getTime();
    expect(until).toBeGreaterThanOrEqual(before + 10 * 60_000);
    expect(until).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
    expect(t.sessions.rows[0]!.lastLoginAt.getTime()).toBe(until - 10 * 60_000);
    const me = [...t.users.values()][0]!.id;
    expect(t.auditRows).toEqual([{ actorUserId: me, action: "session.reauth", targetType: "user", targetId: me }]);
  });

  test("a wrong code is 400 invalid_code, and the session itself keeps working", async () => {
    const t = setup();
    const cookie = await loggedIn(t);
    await t.post("reauth/request", undefined, cookie);
    const wrong = t.codes.at(-1) === "000000" ? "111111" : "000000";

    const res = await t.post("reauth/verify", { code: wrong }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_code" });
    expect((await t.get("session", cookie)).status).toBe(200);
    expect(t.auditRows).toEqual([]); // a failed re-check is not recorded
  });

  test("a code works once", async () => {
    const t = setup();
    const cookie = await loggedIn(t);
    await t.post("reauth/request", undefined, cookie);
    const code = t.codes.at(-1);

    expect((await t.post("reauth/verify", { code }, cookie)).status).toBe(200);
    expect((await t.post("reauth/verify", { code }, cookie)).status).toBe(400);
  });

  test("a code sent to another account's mailbox does not work", async () => {
    const t = setup();
    const mine = await loggedIn(t, "a@example.com");
    const theirs = await loggedIn(t, "b@example.com");
    await t.post("reauth/request", undefined, theirs);

    expect((await t.post("reauth/verify", { code: t.codes.at(-1) }, mine)).status).toBe(400);
  });

  test("a passkey-only account has no email: 409 no_email, and nothing is sent", async () => {
    const t = setup();
    const user = { id: "pk-only", email: null, role: "admin" as const, locale: "en" as const };
    t.users.set("pk-only", user);
    const cookie = `session=${(await t.session.create(user)).token}`;
    const sent = t.codes.length;

    for (const [path, body] of [["reauth/request", undefined], ["reauth/verify", { code: "123456" }]] as const) {
      const res = await t.post(path, body, cookie);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ ok: false, error: "no_email" });
    }
    expect(t.codes.length).toBe(sent);
  });

  test("a malformed code is rejected before anything is checked", async () => {
    const t = setup();
    const cookie = await loggedIn(t);
    expect((await t.post("reauth/verify", { code: "12345" }, cookie)).status).toBe(422);
    expect((await t.post("reauth/verify", {}, cookie)).status).toBe(422);
  });

  test("guessing is capped by the same per-email limit as login: 429 after 10 tries", async () => {
    const t = setup();
    const cookie = await loggedIn(t); // the login's tries are counted apart (per email and IP), so all 10 are left here
    for (let i = 0; i < 10; i++) {
      expect((await t.post("reauth/verify", { code: "000000" }, cookie)).status).not.toBe(429);
    }
    const res = await t.post("reauth/verify", { code: "000000" }, cookie);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
  });
});

describe("register with a name and origin", () => {
  test("the first code creates the account with them; a returning login keeps its own", async () => {
    const { post, codes, users, otpProfiles, advanceOtp } = setup();
    await post("otp/request", { email: "new@example.com" });
    const res = await post("otp/verify", {
      email: "new@example.com",
      code: codes.at(-1),
      profile: { displayName: "  Hana  ", origin: "wakayama", locale: "en" },
    });
    expect(res.status).toBe(200);
    const id = users.get("new@example.com")!.id;
    expect(users.get("new@example.com")!.locale).toBe("en");
    expect(otpProfiles.get(id)).toEqual({ displayName: "Hana", origin: "wakayama", originPlace: null });

    // Logging in again with different details changes nothing.
    advanceOtp(61_000); // past the resend cooldown
    await post("otp/request", { email: "new@example.com" });
    const later = await post("otp/verify", {
      email: "new@example.com",
      code: codes.at(-1),
      profile: { displayName: "Someone else", origin: "overseas" },
    });
    expect(later.status).toBe(200);
    expect(otpProfiles.get(id)).toEqual({ displayName: "Hana", origin: "wakayama", originPlace: null });
  });

  test("a bad name is a 400 and does not use up the code", async () => {
    const { post, codes } = setup();
    await post("otp/request", { email: "n@example.com" });
    const bad = await post("otp/verify", { email: "n@example.com", code: codes.at(-1), profile: { displayName: "a‮b" } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: "invalid_display_name" });
    const good = await post("otp/verify", { email: "n@example.com", code: codes.at(-1) });
    expect(good.status).toBe(200);
  });
});

describe("adding an email to a passkey-only account: POST /auth/email/request and /auth/email/verify", () => {
  async function passkeyOnly(t: ReturnType<typeof setup>) {
    const user = { id: "pk-only", email: null, role: "participant" as const, locale: "ja" as const };
    t.users.set("pk-only", user);
    return `session=${(await t.session.create(user)).token}`;
  }

  test("both steps need a login", async () => {
    const { post } = setup();
    expect((await post("email/request", { email: "new@example.com" })).status).toBe(401);
    expect((await post("email/verify", { email: "new@example.com", code: "123456" })).status).toBe(401);
  });

  test("the code from the new mailbox becomes the account's email", async () => {
    const t = setup();
    const cookie = await passkeyOnly(t);
    expect((await t.post("email/request", { email: "New@Example.com" }, cookie)).status).toBe(200);

    const res = await t.post("email/verify", { email: "new@example.com", code: t.codes.at(-1) }, cookie);
    expect(res.status).toBe(200);
    expect(t.users.get("new@example.com")?.id).toBe("pk-only");
  });

  test("a wrong code is invalid_code and changes nothing", async () => {
    const t = setup();
    const cookie = await passkeyOnly(t);
    await t.post("email/request", { email: "new@example.com" }, cookie);
    const wrong = t.codes.at(-1) === "000000" ? "111111" : "000000";

    const res = await t.post("email/verify", { email: "new@example.com", code: wrong }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_code" });
    expect(t.users.has("new@example.com")).toBe(false);
  });

  test("an address another account owns is refused, after the code was right", async () => {
    const t = setup();
    await t.login("taken@example.com");
    t.advanceOtp(61_000);
    const cookie = await passkeyOnly(t);
    await t.post("email/request", { email: "taken@example.com" }, cookie);

    const res = await t.post("email/verify", { email: "taken@example.com", code: t.codes.at(-1) }, cookie);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "email_in_use" });
  });

  test("an account that already has an email cannot add another this way", async () => {
    const t = setup();
    const { cookie } = await t.login("a@example.com");
    const res = await t.post("email/request", { email: "b@example.com" }, cookie);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "email_in_use" });
  });
});

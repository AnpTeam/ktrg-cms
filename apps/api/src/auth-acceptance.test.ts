// Auth acceptance tests: the whole API (createApp, every route file, the real service wiring)
// on memory stores, with one clock the tests move. The unit tests next to each module check the
// rules one by one; these check that they hold end to end, over HTTP:
//   - the login code rules (10 minutes, 60 s cooldown, 5 guesses, single use, newest wins),
//   - session expiry (participant year, admin 14 days idle / 30 days in total),
//   - user B cannot see or change anything of user A's.
import { describe, expect, test } from "bun:test";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { createApp } from "./app";
import { createMemoryAuditWriter } from "./audit/audit-log";
import { OTP_COOLDOWN_MS, OTP_TTL_MS, normalizeEmail } from "./auth/otp";
import { createMemoryOtpStore } from "./auth/otp-memory-store";
import { createMemoryPasskeyStore } from "./auth/passkey-memory-store";
import { createMemoryRateLimitStore } from "./auth/rate-limit-memory-store";
import { SESSION_POLICY } from "./auth/session";
import { createMemorySessionStore } from "./auth/session-memory-store";
import { TestAuthenticator } from "./auth/webauthn-test-authenticator";
import type { MailMessage } from "./lib/mailer";
import { createMemoryContentStore } from "./content/content-memory-store";
import { createMemoryRallyAdminStore } from "./rallies/rally-admin-memory-store";
import { createMemoryStampStore } from "./stamps/stamp-memory-store";
import { createMemoryNoticeStore } from "./notices/notice-memory-store";
import { createMemorySiteSettingsStore } from "./site-settings/site-settings";
import { createMemoryPlaceStore } from "./places/place-directory";
import { createMemoryFuriganaStore } from "./furigana/furigana-words";
import { createMemoryBannerStore } from "./banners/banner-list";
import { memoryReader } from "./admin-lists/list-memory-store";
import { createMemoryUserListStore } from "./users/user-list";
import { createMemoryMeStore } from "./me/me-memory-store";
import { createServices } from "./services";

/** A well-formed trail notice body (the admin list's create needs every field). */
const sampleNotice = () => ({
  routeId: null,
  titleJa: "x",
  titleEn: null,
  bodyJa: "x",
  bodyEn: null,
  sourceUrl: "https://example.com/",
  sourceNameJa: "x",
  sourceNameEn: null,
  verifiedOn: "2026-10-20",
  expiresOn: null,
  published: false,
});

const DAY = 24 * 60 * 60 * 1000;
const passkeyConfig = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const UNAUTHENTICATED = { ok: false, error: "unauthenticated" };

type User = { id: string; email: string | null; role: string; locale: string };
type Profile = User & { displayName: string | null; deletionRequestedAt: string | null };

function setup(opts: { adminEmails?: string[] } = {}) {
  // Start at real time: the cookie's Max-Age is counted from the real clock.
  let clock = new Date();
  const { store: otpStore, users } = createMemoryOtpStore();
  const sessions = createMemorySessionStore(users);
  const passkeys = createMemoryPasskeyStore(users);
  const profiles = createMemoryMeStore(users);
  const audit = createMemoryAuditWriter();
  const mail: MailMessage[] = [];
  const stampMem = createMemoryStampStore(audit.writer);
  const services = createServices({
    stores: {
      otp: otpStore,
      session: sessions.store,
      rateLimit: createMemoryRateLimitStore().store,
      passkeys: passkeys.store,
      me: profiles.store,
      content: createMemoryContentStore(audit.writer).store,
      rallyAdmin: createMemoryRallyAdminStore(audit.writer).store,
      stamps: stampMem.store,
      stampList: stampMem.listStore,
      notices: createMemoryNoticeStore(audit.writer).store,
      banners: createMemoryBannerStore(audit.writer).store,
      furigana: createMemoryFuriganaStore(audit.writer).store,
      places: createMemoryPlaceStore(audit.writer).store,
      siteSettings: createMemorySiteSettingsStore(audit.writer),
      auditList: memoryReader(new Map()),
      placeList: memoryReader(new Map()),
      userList: createMemoryUserListStore(audit.writer).store,
    },
    audit: audit.writer,
    mailer: {
      async send(m) {
        mail.push(m);
      },
    },
    secret: "acceptance-test-secret-acceptance-0",
    adminEmails: new Set(opts.adminEmails ?? []),
    passkey: passkeyConfig,
    now: () => clock,
  });
  const app = createApp(() => services, { secureCookies: false, docs: false });

  const call = (method: string, path: string, o: { cookie?: string; body?: unknown } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: {
          // A FormData body (a file upload) sets its own multipart content type.
          ...(o.body === undefined || o.body instanceof FormData ? {} : { "content-type": "application/json" }),
          ...(o.cookie ? { cookie: o.cookie } : {}),
        },
        body: o.body === undefined ? undefined : o.body instanceof FormData ? o.body : JSON.stringify(o.body),
      }),
    );

  /** The newest code mailed to this address (codes go to the normalized address). */
  const codeFor = (email: string) => {
    const code = mail.filter((m) => m.to === normalizeEmail(email)).at(-1)?.text.match(/\d{6}/)?.[0];
    if (!code) throw new Error(`no code mailed to ${email}`);
    return code;
  };
  const requestCode = (email: string) => call("POST", "/auth/otp/request", { body: { email } });
  const verify = (email: string, code: string) => call("POST", "/auth/otp/verify", { body: { email, code } });

  /** Log in with an email code; returns the cookie to send back and the user. */
  async function login(email: string) {
    await requestCode(email);
    const res = await verify(email, codeFor(email));
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as { user: User };
    return { cookie: res.headers.get("set-cookie")!.split(";")[0]!, user };
  }

  async function me(cookie: string) {
    const res = await call("GET", "/me", { cookie });
    return { status: res.status, me: res.status === 200 ? ((await res.json()) as { me: Profile }).me : null };
  }

  /** Add a passkey over HTTP (options, then verify), as the browser would. */
  async function addPasskey(cookie: string) {
    const options = await registrationOptions(cookie);
    const res = await call("POST", "/auth/passkeys/register/verify", { cookie, body: { response: phone().register(options) } });
    expect(res.status).toBe(200);
    return ((await res.json()) as { passkey: { id: string } }).passkey.id;
  }
  async function registrationOptions(cookie: string) {
    const res = await call("POST", "/auth/passkeys/register/options", { cookie });
    return ((await res.json()) as { options: PublicKeyCredentialCreationOptionsJSON }).options;
  }
  const phone = () => new TestAuthenticator({ origin: passkeyConfig.origin, rpId: passkeyConfig.rpId });

  return {
    app,
    call,
    codeFor,
    requestCode,
    verify,
    login,
    me,
    addPasskey,
    registrationOptions,
    phone,
    mail,
    users,
    sessionRows: sessions.rows,
    passkeyRows: passkeys.passkeys,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
}

/** Any 6 digits other than this code. */
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("login code rules, end to end", () => {
  test("the first login creates the account; later logins, in any letter case, reach the same one", async () => {
    const s = setup();
    const first = await s.login("walker@example.com");
    s.advance(OTP_COOLDOWN_MS);
    const again = await s.login("Walker@Example.COM");

    expect(again.user.id).toBe(first.user.id);
    expect(s.users.size).toBe(1);
    expect((await s.me(again.cookie)).me?.email).toBe("walker@example.com");
  });

  test("a code works for 10 minutes and not a moment longer", async () => {
    for (const [age, status] of [
      [OTP_TTL_MS - 1, 200],
      [OTP_TTL_MS, 401],
    ] as const) {
      const s = setup();
      await s.requestCode("a@example.com");
      s.advance(age);
      expect((await s.verify("a@example.com", s.codeFor("a@example.com"))).status).toBe(status);
    }
  });

  test("inside the 60 s cooldown nothing is sent; after it a new code replaces the old one", async () => {
    const s = setup();
    await s.requestCode("a@example.com");
    const oldCode = s.codeFor("a@example.com");

    s.advance(OTP_COOLDOWN_MS - 1);
    const held = await s.requestCode("a@example.com");
    expect(held.status).toBe(200); // the same answer as a sent code
    expect(s.mail).toHaveLength(1);

    s.advance(1);
    await s.requestCode("a@example.com");
    expect(s.mail).toHaveLength(2);
    const newCode = s.codeFor("a@example.com");

    if (newCode !== oldCode) expect((await s.verify("a@example.com", oldCode)).status).toBe(401);
    expect((await s.verify("a@example.com", newCode)).status).toBe(200);
  });

  test("5 wrong guesses lock the code, the right one included; a new code after the cooldown works", async () => {
    const s = setup();
    await s.requestCode("a@example.com");
    const code = s.codeFor("a@example.com");
    for (let i = 0; i < 5; i++) expect((await s.verify("a@example.com", wrong(code))).status).toBe(401);
    expect((await s.verify("a@example.com", code)).status).toBe(401);
    expect(s.sessionRows).toHaveLength(0);

    s.advance(OTP_COOLDOWN_MS);
    await s.requestCode("a@example.com");
    expect((await s.verify("a@example.com", s.codeFor("a@example.com"))).status).toBe(200);
  });

  test("a code logs in once: replaying it is the same 401 and starts no second session", async () => {
    const s = setup();
    await s.login("a@example.com");
    const replay = await s.verify("a@example.com", s.codeFor("a@example.com"));
    expect(replay.status).toBe(401);
    expect(await replay.json()).toEqual({ ok: false, error: "invalid_code" });
    expect(replay.headers.get("set-cookie")).toBeNull();
    expect(s.sessionRows).toHaveLength(1);
  });
});

describe("session expiry, end to end", () => {
  test("a participant stays logged in for a year, then is logged out and the session row is gone", async () => {
    const s = setup();
    const { cookie } = await s.login("a@example.com");

    s.advance(SESSION_POLICY.participant.absoluteMs - DAY);
    expect((await s.me(cookie)).status).toBe(200);

    s.advance(DAY);
    expect((await s.me(cookie)).status).toBe(401);
    const session = await s.call("GET", "/auth/session", { cookie });
    expect(session.status).toBe(401);
    expect(await session.json()).toEqual(UNAUTHENTICATED);
    expect(s.sessionRows).toHaveLength(0);
  });

  test("an admin left idle for 14 days is logged out", async () => {
    for (const [idle, status] of [
      [SESSION_POLICY.admin.idleMs - 1, 200],
      [SESSION_POLICY.admin.idleMs, 401],
    ] as const) {
      const s = setup({ adminEmails: ["boss@example.com"] });
      const { cookie, user } = await s.login("boss@example.com");
      expect(user.role).toBe("admin");
      s.advance(idle);
      expect((await s.me(cookie)).status).toBe(status);
    }
  });

  test("an admin in daily use is still logged out 30 days after logging in, and the cookie follows the slide", async () => {
    const s = setup({ adminEmails: ["boss@example.com"] });
    const { cookie } = await s.login("boss@example.com");

    s.advance(13 * DAY);
    const slid = await s.call("GET", "/me", { cookie });
    expect(slid.status).toBe(200);
    expect(slid.headers.get("set-cookie")).toStartWith(`${cookie}; Path=/; HttpOnly`);

    s.advance(13 * DAY);
    expect((await s.me(cookie)).status).toBe(200);
    s.advance(4 * DAY - 1);
    expect((await s.me(cookie)).status).toBe(200);
    s.advance(1); // 30 days since the login, 4 days since the last use
    expect((await s.me(cookie)).status).toBe(401);
  });

  test("an ended session stays ended, even if the clock goes back", async () => {
    const s = setup({ adminEmails: ["boss@example.com"] });
    const { cookie } = await s.login("boss@example.com");
    s.advance(SESSION_POLICY.admin.idleMs);
    expect((await s.me(cookie)).status).toBe(401);
    s.advance(-SESSION_POLICY.admin.idleMs);
    expect((await s.me(cookie)).status).toBe(401);
  });

  test("logging out ends that session only; the same account on another device stays in", async () => {
    const s = setup();
    const laptop = await s.login("a@example.com");
    s.advance(OTP_COOLDOWN_MS);
    const phone = await s.login("a@example.com");

    expect((await s.call("POST", "/auth/logout", { cookie: laptop.cookie })).status).toBe(200);
    expect((await s.me(laptop.cookie)).status).toBe(401);
    expect((await s.me(phone.cookie)).status).toBe(200);
  });
});

describe("user B cannot touch user A", () => {
  /** Routes anyone may call: health and the login and sign-up steps. */
  const PUBLIC = new Set([
    "GET /api/v1/health",
    // What visitors read: routes and published places (see content/content-routes.test.ts).
    "GET /api/v1/routes",
    "GET /api/v1/routes/:id",
    "GET /api/v1/spots/status",
    "GET /api/v1/spots/:id",
    // Published stamp rallies (see rallies/rally-admin-routes.test.ts).
    "GET /api/v1/rallies",
    // Stamps kept in a signed cookie for a visitor with no account (see guest/guest-routes.test.ts); claiming them is logged-in.
    "POST /api/v1/guest/stamps",
    "GET /api/v1/guest/stamps",
    "GET /api/v1/guest/backup",
    "POST /api/v1/guest/restore",
    // Published trail notices (see notices/notice-routes.test.ts).
    "GET /api/v1/notices",
    // The furigana words visitors read (see furigana/furigana-words.test.ts).
    "GET /api/v1/furigana/words",
    // Published home page banners (see banners/banner-list.test.ts).
    "GET /api/v1/banners",
    // Published places with a checked position (see places/place-directory.test.ts).
    "GET /api/v1/places",
    // The site-wide settings visitors read: the map style (see site-settings/site-settings.test.ts).
    "GET /api/v1/settings",
    "POST /api/v1/auth/otp/request",
    "POST /api/v1/auth/otp/verify",
    "POST /api/v1/auth/logout",
    "POST /api/v1/auth/passkeys/signup/options",
    "POST /api/v1/auth/passkeys/signup/verify",
    "POST /api/v1/auth/passkeys/login/options",
    "POST /api/v1/auth/passkeys/login/verify",
    // Not for people: a scheduler calls it with a bearer secret (404 without one configured); see internal/purge-routes.test.ts.
    "POST /api/v1/internal/purge-deletions",
  ]);
  /** A well-formed body for each logged-in route that needs one (validation runs before the guard). */
  const BODIES: Record<string, () => unknown> = {
    "PATCH /api/v1/me": () => ({ locale: "en" }),
    "POST /api/v1/guest/claim": () => ({ mode: "merge" }),
    "POST /api/v1/admin/routes": () => ({ nameJa: "x" }),
    "PUT /api/v1/admin/routes/order": () => ({ ids: [] }),
    "POST /api/v1/admin/route-snap": () => ({ points: [{ lat: 34, lng: 135 }, { lat: 34.1, lng: 135.1 }] }),
    "PATCH /api/v1/admin/routes/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/routes/:id/spots": () => ({ nameJa: "x" }),
    "PUT /api/v1/admin/routes/:id/spots/order": () => ({ ids: [] }),
    "PATCH /api/v1/admin/spots/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/rallies": () => ({ kind: "course", nameJa: "x" }),
    "PATCH /api/v1/admin/lists/stamps/:id": () => ({ updatedAt: new Date().toISOString(), revoked: true }),
    "POST /api/v1/navigation/path": () => ({ spotId: crypto.randomUUID(), lat: 34, lng: 135 }),
    "POST /api/v1/stamps": () => ({ spotId: crypto.randomUUID(), lat: 34, lng: 135, accuracyM: 10 }),
    "PUT /api/v1/admin/rallies/order": () => ({ ids: [] }),
    "PATCH /api/v1/admin/rallies/:id": () => ({ updatedAt: new Date().toISOString() }),
    "PUT /api/v1/admin/rallies/:id/places": () => ({ updatedAt: new Date().toISOString(), spotIds: [] }),
    "PUT /api/v1/admin/rallies/:id/courses": () => ({ updatedAt: new Date().toISOString(), routeIds: [] }),
    "POST /api/v1/admin/lists/notices": () => sampleNotice(),
    "PATCH /api/v1/admin/lists/notices/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/lists/banners": () => ({ imageUrl: "https://example.com/a.jpg", altJa: "x", altEn: null, sortOrder: 0, published: false }),
    "PATCH /api/v1/admin/lists/banners/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/lists/furigana": () => ({ word: "葛城", reading: "かつらぎ" }),
    "PATCH /api/v1/admin/lists/furigana/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/lists/directory": () => ({
      category: "cafe", routeId: null, nameJa: "x", nameEn: null, descriptionJa: null, descriptionEn: null, hoursJa: null, hoursEn: null, closedDaysJa: null, closedDaysEn: null,
      lat: null, lng: null, positionVerified: false, positionSource: null, address: null, phone: null, website: null, photoUrl: null, status: "unknown", lastVerified: null,
      listingConfirmed: false, listingNote: null, published: false,
    }),
    "PUT /api/v1/admin/settings/map-style": () => ({ base: "pale", terrain: "hillshade", terrainOpacity: 0.5, saturation: 0, contrast: 0 }),
    "PATCH /api/v1/admin/lists/directory/:id": () => ({ updatedAt: new Date().toISOString() }),
    "POST /api/v1/admin/lists/directory/import": () => ({ csv: "", apply: false }),
    "PATCH /api/v1/admin/lists/users/:id": () => ({ updatedAt: new Date().toISOString(), role: "admin" }),
    "POST /api/v1/auth/reauth/verify": () => ({ code: "123456" }),
    "POST /api/v1/auth/email/request": () => ({ email: "new@example.com" }),
    "POST /api/v1/auth/email/verify": () => ({ email: "new@example.com", code: "123456" }),
    "POST /api/v1/admin/uploads/video": () => ({ name: "a.mp4", contentType: "video/mp4", size: 1024 }),
    "POST /api/v1/admin/uploads/subtitles": () => ({ videoUrl: "https://photos.example.com/videos/a.mp4", size: 1024 }),
    "POST /api/v1/admin/uploads": () => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg"));
      return form;
    },
    "POST /api/v1/auth/passkeys/reauth/verify": () => ({
      response: new TestAuthenticator(passkeyConfig).authenticate({ challenge: "x".repeat(43) }),
    }),
    "POST /api/v1/auth/passkeys/register/verify": () => ({
      response: new TestAuthenticator(passkeyConfig).register({ challenge: "x".repeat(43) }),
    }),
  };

  test("every route except the public ones needs a login: one fixed 401, with no cookie or a made-up one", async () => {
    const s = setup();
    const routes = s.app.routes
      .map((r) => `${r.method} ${r.path.replace(/(.)\/$/, "$1")}`) // "/me/" is "/me"
      .filter((key) => !PUBLIC.has(key));
    // Catches the inventory itself going stale.
    expect(routes).toContain("GET /api/v1/me");
    expect(routes).toContain("DELETE /api/v1/auth/passkeys/:id");

    for (const key of routes) {
      const [method, path] = key.split(" ") as [string, string];
      const url = path.replace("/api/v1", "").replace(":id", crypto.randomUUID());
      for (const cookie of [undefined, "session=made-up-token"]) {
        const res = await s.call(method, url, { cookie, body: BODIES[key]?.() });
        expect({ key, status: res.status, body: await res.json() }).toEqual({ key, status: 401, body: UNAUTHENTICATED });
      }
    }
  });

  test("B's session only ever shows B: profile, session and passkey list", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");
    await s.addPasskey(a.cookie);

    expect((await s.me(b.cookie)).me?.id).toBe(b.user.id);
    const session = (await (await s.call("GET", "/auth/session", { cookie: b.cookie })).json()) as { user: User };
    expect(session.user.id).toBe(b.user.id);
    const list = (await (await s.call("GET", "/auth/passkeys", { cookie: b.cookie })).json()) as { passkeys: unknown[] };
    expect(list.passkeys).toEqual([]);
  });

  test("B cannot remove A's passkey: the same 404 as a made-up id, A keeps it and gets no alert", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");
    const aPasskey = await s.addPasskey(a.cookie);
    const mailBefore = s.mail.length;

    const theirs = await s.call("DELETE", `/auth/passkeys/${aPasskey}`, { cookie: b.cookie });
    const madeUp = await s.call("DELETE", `/auth/passkeys/${crypto.randomUUID()}`, { cookie: b.cookie });
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await madeUp.json());

    expect(s.passkeyRows.map((p) => p.id)).toEqual([aPasskey]);
    expect(s.mail.length).toBe(mailBefore);
  });

  test("B cannot finish a passkey registration A started, and A still can", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");
    const response = s.phone().register(await s.registrationOptions(a.cookie));

    const stolen = await s.call("POST", "/auth/passkeys/register/verify", { cookie: b.cookie, body: { response } });
    expect(stolen.status).toBe(400);
    expect(s.passkeyRows).toHaveLength(0);

    const own = await s.call("POST", "/auth/passkeys/register/verify", { cookie: a.cookie, body: { response } });
    expect(own.status).toBe(200);
    expect(s.passkeyRows.map((p) => p.userId)).toEqual([a.user.id]);
  });

  test("B's profile changes never reach A, even with A's id in the body", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");
    const aBefore = (await s.me(a.cookie)).me;

    const res = await s.call("PATCH", "/me", {
      cookie: b.cookie,
      body: { locale: "en", displayName: "B", id: a.user.id, userId: a.user.id },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { me: Profile }).me).toMatchObject({ id: b.user.id, locale: "en", displayName: "B" });
    expect((await s.me(a.cookie)).me).toEqual(aBefore);
  });

  test("B's deletion request and cancel act on B only, and only B is emailed", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");

    expect((await s.call("DELETE", "/me", { cookie: a.cookie })).status).toBe(202);
    expect((await s.call("POST", "/me/deletion/cancel", { cookie: b.cookie })).status).toBe(200);
    expect((await s.me(a.cookie)).me?.deletionRequestedAt).not.toBeNull();

    const mailBefore = s.mail.length;
    expect((await s.call("DELETE", "/me", { cookie: b.cookie })).status).toBe(202);
    expect(s.mail.slice(mailBefore).map((m) => m.to)).toEqual(["b@example.com"]);
    expect((await s.call("POST", "/me/deletion/cancel", { cookie: b.cookie })).status).toBe(200);
    expect((await s.me(a.cookie)).me?.deletionRequestedAt).not.toBeNull();
  });

  test("B using up its own rate limit does not lock A out", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");

    // Request, cancel, request, cancel, request: the 5 allowed in 15 minutes.
    for (let i = 0; i < 2; i++) {
      await s.call("DELETE", "/me", { cookie: b.cookie });
      await s.call("POST", "/me/deletion/cancel", { cookie: b.cookie });
    }
    expect((await s.call("DELETE", "/me", { cookie: b.cookie })).status).toBe(202);
    expect((await s.call("DELETE", "/me", { cookie: b.cookie })).status).toBe(429);
    expect((await s.call("DELETE", "/me", { cookie: a.cookie })).status).toBe(202);
  });

  test("a code mailed to B does not log in to A's account", async () => {
    const s = setup();
    await s.login("a@example.com");
    await s.requestCode("b@example.com");
    expect((await s.verify("a@example.com", s.codeFor("b@example.com"))).status).toBe(401);
    expect(s.sessionRows).toHaveLength(1);
  });

  test("only the token opens a session: A's session id or stored hash in a cookie gets B nowhere", async () => {
    const s = setup();
    await s.login("a@example.com");
    const row = s.sessionRows[0]!;
    for (const value of [row.id, row.tokenHash]) {
      expect((await s.me(`session=${value}`)).status).toBe(401);
    }
  });

  test("A logging out does not end B's session", async () => {
    const s = setup();
    const a = await s.login("a@example.com");
    const b = await s.login("b@example.com");
    await s.call("POST", "/auth/logout", { cookie: a.cookie });
    expect((await s.me(b.cookie)).status).toBe(200);
  });
});

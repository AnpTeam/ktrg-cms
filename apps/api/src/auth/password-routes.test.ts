import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import type { EmailContent } from "../emails/layout";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { createMemoryPasswordStore } from "./password-memory-store";
import { passwordRoutes } from "./password-routes";
import { createPasswordService, UNDO_TTL_MS } from "./password-service";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import type { AuthUser } from "./user";

const COST = 2 ** 4;
const GOOD = "yamabushi-walk";
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };
const bob: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "bob@example.com", role: "participant", locale: "ja" };
const editor: AuthUser = { id: "33333333-3333-3333-3333-333333333333", email: "editor@example.com", role: "editor", locale: "ja" };
const noEmail: AuthUser = { id: "44444444-4444-4444-4444-444444444444", email: null, role: "participant", locale: "ja" };

function setup() {
  const users = new Map<string, AuthUser>([alice, bob, editor, noEmail].map((u) => [u.id, u]));
  let at = new Date("2026-11-06T00:00:00Z");
  const now = () => at;
  const session = createSessionService({ store: createMemorySessionStore(users).store, now });
  const mem = createMemoryPasswordStore(users);
  const sent: EmailContent[] = [];
  const mailer = { send: async (m: EmailContent) => void sent.push(m) };
  const passwords = createPasswordService({ store: mem.store, mailer, appOrigin: "https://example.com", now, cost: COST });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32), now });
  const app = new Elysia({ prefix: "/api/v1" }).use(passwordRoutes(() => ({ passwords, session, rateLimit, audit: audit.writer }), { secureCookies: false }));

  const call = (method: string, path: string, body?: unknown, cookie?: string) =>
    app.handle(
      new Request(`http://localhost/api/v1/auth/password${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const cookieFor = async (user: AuthUser, fresh = true) => `session=${(await session.create(user, { fresh })).token}`;
  const undoToken = () => (sent.at(-1)!.text.match(/undo#([\w-]{43})/) ?? [])[1]!;
  const setUp = async (user = alice) => {
    expect((await call("PUT", "", { password: GOOD }, await cookieFor(user))).status).toBe(200);
  };
  const stillIn = async (cookie: string) => (await call("GET", "", undefined, cookie)).status === 200;
  const passTime = (ms: number) => (at = new Date(at.getTime() + ms));
  return { call, cookieFor, undoToken, setUp, stillIn, passTime, sent, mem };
}

describe("the password itself", () => {
  test("only a hash is kept, and it checks the right password only", async () => {
    const hash = await hashPassword(GOOD, COST);
    expect(hash).not.toContain(GOOD);
    expect(await verifyPassword(GOOD, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  test("full-width characters from a Japanese keyboard match their plain form", async () => {
    expect(await verifyPassword("ｐａｓｓ１２３４", await hashPassword("pass1234", COST))).toBe(true);
  });

  test("too short, common, one repeated character, or the email itself are refused", () => {
    expect(passwordProblem("short", null)).toBe("too_short");
    expect(passwordProblem("Password", null)).toBe("too_common");
    expect(passwordProblem("aaaaaaaaaa", null)).toBe("too_common");
    expect(passwordProblem("hanako-yamada", "hanako-yamada@example.com")).toBe("too_common");
    expect(passwordProblem(GOOD, "alice@example.com")).toBeNull();
  });
});

describe("logging in", () => {
  test("the right password starts a session", async () => {
    const { call, setUp } = setup();
    await setUp();
    const res = await call("POST", "/login", { email: "ALICE@example.com", password: GOOD });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  test("wrong password, unknown address, no password and a staff account all get the same answer", async () => {
    const { call, setUp, mem } = setup();
    await setUp();
    mem.hashes.set(editor.id, await hashPassword(GOOD, COST)); // a participant with a password who was later made staff
    const tries = [
      { email: alice.email, password: "wrong-password" },
      { email: "nobody@example.com", password: GOOD },
      { email: bob.email, password: GOOD },
      { email: editor.email, password: GOOD },
    ];
    for (const body of tries) {
      const res = await call("POST", "/login", body);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ ok: false, error: "invalid_login" });
    }
  });

  test("a password login is not a fresh login: it cannot change the password", async () => {
    const { call, setUp } = setup();
    await setUp();
    const res = await call("POST", "/login", { email: alice.email, password: GOOD });
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    const change = await call("PUT", "", { password: "another-good-one" }, cookie);
    expect(change.status).toBe(403);
    expect(await change.json()).toMatchObject({ error: "reauth_required" });
    expect((await call("DELETE", "", undefined, cookie)).status).toBe(403);
  });

  test("guessing stops at the limit", async () => {
    const { call, setUp } = setup();
    await setUp();
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await call("POST", "/login", { email: alice.email, password: "wrong-password" })).status;
    expect(last).toBe(429);
  });
});

describe("setting, changing and removing", () => {
  test("needs a login, a fresh one, and an account with an email", async () => {
    const { call, cookieFor } = setup();
    expect((await call("PUT", "", { password: GOOD })).status).toBe(401);
    expect((await call("PUT", "", { password: GOOD }, await cookieFor(alice, false))).status).toBe(403);
    const res = await call("PUT", "", { password: GOOD }, await cookieFor(noEmail));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "no_email" });
  });

  test("a staff account cannot have one", async () => {
    const { call, cookieFor } = setup();
    const cookie = await cookieFor(editor);
    expect((await call("PUT", "", { password: GOOD }, cookie)).status).toBe(403);
    expect(await (await call("GET", "", undefined, cookie)).json()).toMatchObject({ hasPassword: false, allowed: false });
  });

  test("a weak password is refused with its reason", async () => {
    const { call, cookieFor } = setup();
    const cookie = await cookieFor(alice);
    expect(await (await call("PUT", "", { password: "short" }, cookie)).json()).toMatchObject({ error: "password_too_short" });
    expect(await (await call("PUT", "", { password: "password" }, cookie)).json()).toMatchObject({ error: "password_too_common" });
  });

  test("setting it mails the owner a link, signs out other devices and keeps this one", async () => {
    const { call, cookieFor, stillIn, sent, mem } = setup();
    const other = await cookieFor(alice);
    const mine = await cookieFor(alice);
    expect((await call("PUT", "", { password: GOOD }, mine)).status).toBe(200);
    expect(sent[0]!.subject).toContain("A password was set");
    expect(sent[0]!.text).toContain("https://example.com/password/undo#");
    expect(mem.hashes.get(alice.id)).not.toContain(GOOD);
    expect(await stillIn(mine)).toBe(true);
    expect(await stillIn(other)).toBe(false);
  });

  test("changing and removing say so in the email; only your own account is touched", async () => {
    const { call, cookieFor, setUp, sent, mem } = setup();
    await setUp(alice);
    await setUp(bob);
    const cookie = await cookieFor(alice);
    await call("PUT", "", { password: "another-good-one" }, cookie);
    expect(sent.at(-1)!.subject).toContain("Your password was changed");
    expect((await call("DELETE", "", undefined, cookie)).status).toBe(200);
    expect(sent.at(-1)!.subject).toContain("Your password was removed");
    expect(sent.at(-1)!.text).not.toContain("/password/undo");
    expect(mem.hashes.has(alice.id)).toBe(false);
    expect(mem.hashes.has(bob.id)).toBe(true);
    expect((await call("DELETE", "", undefined, cookie)).status).toBe(404);
  });
});

describe("the undo link", () => {
  test("removes the password and signs out every device, once", async () => {
    const { call, cookieFor, setUp, undoToken, stillIn, mem } = setup();
    const cookie = await cookieFor(alice);
    await setUp();
    const token = undoToken();
    expect((await call("POST", "/undo", { token })).status).toBe(200);
    expect(mem.hashes.has(alice.id)).toBe(false);
    expect(await stillIn(cookie)).toBe(false);
    expect((await call("POST", "/login", { email: alice.email, password: GOOD })).status).toBe(401);
    const again = await call("POST", "/undo", { token });
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ error: "invalid_undo_link" });
  });

  test("an older link still works after a second change, so an intruder cannot void it by changing twice", async () => {
    const { call, setUp, undoToken, mem } = setup();
    await setUp();
    const first = undoToken();
    await setUp();
    expect((await call("POST", "/undo", { token: first })).status).toBe(200);
    expect(mem.hashes.has(alice.id)).toBe(false);
  });

  test("stops working after 7 days, and a made-up token does nothing", async () => {
    const { call, setUp, undoToken, passTime, mem } = setup();
    await setUp();
    const token = undoToken();
    expect((await call("POST", "/undo", { token: "x".repeat(43) })).status).toBe(400);
    passTime(UNDO_TTL_MS);
    expect((await call("POST", "/undo", { token })).status).toBe(400);
    expect(mem.hashes.has(alice.id)).toBe(true);
  });
});

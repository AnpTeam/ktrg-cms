import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { authGuards } from "./guards";
import { needsStaffCheck, PERMISSIONS, can, type Permission } from "./permissions";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { authRoutes } from "./routes";
import { FRESH_LOGIN_MS, STAFF_CHECK_KEPT_MS, STAFF_CHECK_MS } from "./session";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import type { AuthUser } from "./user";
import type { OtpService } from "./otp-service";

const admin: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const editor: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "editor@example.com", role: "editor", locale: "ja" };
const visitor: AuthUser = { id: "33333333-3333-3333-3333-333333333333", email: "visitor@example.com", role: "participant", locale: "ja" };

function setup() {
  const users = new Map<string, AuthUser>([admin, editor, visitor].map((u) => [u.id, u]));
  let at = new Date("2026-11-06T00:00:00Z");
  const now = () => at;
  const session = createSessionService({ store: createMemorySessionStore(users).store, now });
  const audit = createMemoryAuditWriter();
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "p".repeat(32), now });
  const otp = { checkCode: async () => true, request: async () => {} } as unknown as OtpService;
  const app = new Elysia()
    .use(authRoutes(() => ({ otp, session, rateLimit, audit: audit.writer }), { secureCookies: false }))
    .use(authGuards({ getSession: () => session, secureCookies: false }))
    .get("/cms", () => "cms", { auth: "route.manage" })
    .get("/mine", () => "mine", { auth: "me.manage" });

  const call = (method: string, path: string, cookie: string, body?: unknown) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const login = async (user: AuthUser) => `session=${(await session.create(user)).token}`;
  const passCheck = (cookie: string) => call("POST", "/auth/reauth/verify", cookie, { code: "123456" });
  const passTime = (ms: number) => (at = new Date(at.getTime() + ms));
  return { call, login, passCheck, passTime, auditRows: audit.rows };
}

describe("the admin check", () => {
  test("every permission only staff have needs it, and no visitor permission does", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(needsStaffCheck(p)).toBe(!can("participant", p));
    expect(needsStaffCheck("route.manage")).toBe(true);
    expect(needsStaffCheck("me.manage")).toBe(false);
  });

  test("a login opens the admin screens for 12 hours, then the API refuses until the check is passed", async () => {
    const { call, login, passCheck, passTime } = setup();
    const cookie = await login(editor);
    expect((await call("GET", "/cms", cookie)).status).toBe(200);
    passTime(STAFF_CHECK_MS - 1000);
    expect((await call("GET", "/cms", cookie)).status).toBe(200);
    passTime(1000);
    const refused = await call("GET", "/cms", cookie);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: "staff_check_required" });
    expect(await (await call("GET", "/auth/staff-check", cookie)).json()).toMatchObject({ checked: false });
    expect((await call("GET", "/mine", cookie)).status).toBe(200); // the rest of the app still works
    expect((await passCheck(cookie)).status).toBe(200);
    expect((await call("GET", "/cms", cookie)).status).toBe(200);
    passTime(STAFF_CHECK_MS);
    expect((await call("GET", "/cms", cookie)).status).toBe(403);
  });

  test("keeping the device opens them for 30 days, and a later check does not shorten that", async () => {
    const { call, login, passCheck, passTime, auditRows } = setup();
    const cookie = await login(admin);
    expect((await call("POST", "/auth/staff-check/keep", cookie)).status).toBe(200);
    expect(auditRows.map((r) => r.action)).toContain("session.keep_staff_check");
    passTime(STAFF_CHECK_MS * 2);
    expect((await passCheck(cookie)).status).toBe(200);
    passTime(STAFF_CHECK_MS * 2);
    expect((await call("GET", "/cms", cookie)).status).toBe(200);
    passTime(STAFF_CHECK_KEPT_MS);
    expect((await call("GET", "/cms", cookie)).status).not.toBe(200);
  });

  test("an old session cannot keep itself: it has to pass the check first", async () => {
    const { call, login, passTime } = setup();
    const cookie = await login(admin);
    passTime(FRESH_LOGIN_MS);
    expect((await call("POST", "/auth/staff-check/keep", cookie)).status).toBe(403);
    passTime(STAFF_CHECK_MS);
    expect((await call("POST", "/auth/staff-check/keep", cookie)).status).toBe(403);
  });

  test("a visitor is told nothing about it and cannot keep a device", async () => {
    const { call, login } = setup();
    const cookie = await login(visitor);
    const res = await call("GET", "/cms", cookie);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "forbidden" });
    expect(await (await call("POST", "/auth/staff-check/keep", cookie)).json()).toMatchObject({ error: "forbidden" });
  });

  test("each session is checked on its own", async () => {
    const { call, login, passCheck, passTime } = setup();
    const laptop = await login(admin);
    const phone = await login(admin);
    passTime(STAFF_CHECK_MS);
    await passCheck(laptop);
    expect((await call("GET", "/cms", laptop)).status).toBe(200);
    expect((await call("GET", "/cms", phone)).status).toBe(403);
  });
});

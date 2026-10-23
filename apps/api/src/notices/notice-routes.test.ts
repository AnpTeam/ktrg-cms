import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { listReadRoutes, listWriteRoutes } from "../admin-lists/list-routes";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryNoticeStore } from "./notice-memory-store";
import { noticeList, publicNoticeRoutes } from "./notice-routes";
import { createNoticeService } from "./notice-service";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const ROUTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const notice = (over: Record<string, unknown> = {}) => ({
  routeId: ROUTE,
  titleJa: "  通行止め  ",
  titleEn: "  ",
  bodyJa: "工事のため通れません。",
  bodyEn: null,
  sourceUrl: "https://www.pref.nara.jp/",
  sourceNameJa: "奈良県",
  sourceNameEn: "Nara Prefecture",
  verifiedOn: "2026-10-20",
  expiresOn: "2026-10-31",
  published: false,
  ...over,
});

/** `now` is 2026-10-20 15:30 UTC, already 2026-10-21 00:30 in Japan. */
function setup(now = () => new Date("2026-10-20T15:30:00Z")) {
  const users = new Map<string, AuthUser>([[admin.id, { ...admin }], [alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryNoticeStore(audit.writer, { routes: [ROUTE] });
  const notices = createNoticeService({ store: mem.store, now });
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const services = { session, rateLimit, audit: audit.writer, notices };
  const opts = { secureCookies: false };
  const app = new Elysia({ prefix: "/api/v1" })
    .use(apiBase())
    .use(listReadRoutes(noticeList, () => services, opts))
    .use(listWriteRoutes(noticeList, () => services, opts))
    .use(publicNoticeRoutes(() => notices));
  const call = async (method: string, path: string, o: { cookie?: string; body?: unknown } = {}) => {
    const res = await app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(o.body === undefined ? {} : { "content-type": "application/json" }), ...(o.cookie ? { cookie: o.cookie } : {}) },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      }),
    );
    return { status: res.status, body: (await res.json()) as Json };
  };
  const login = async (u: AuthUser) => `session=${(await session.create(users.get(u.id)!)).token}`;
  return { call, login, audit, mem };
}
type Json = Record<string, any>; // eslint-disable-line -- test helper: bodies are checked field by field below

describe("the notices admin list needs an admin", () => {
  test("signed out: 401; a participant: 403 on every route; nothing is changed or recorded", async () => {
    const s = setup();
    const id = crypto.randomUUID();
    const cases: [string, string, unknown?][] = [
      ["GET", "/admin/lists/notices"],
      ["GET", `/admin/lists/notices/${id}`],
      ["POST", "/admin/lists/notices", notice()],
      ["PATCH", `/admin/lists/notices/${id}`, { updatedAt: new Date().toISOString() }],
      ["DELETE", `/admin/lists/notices/${id}`],
    ];
    const cookie = await s.login(alice);
    for (const [method, path, body] of cases) {
      expect({ path, status: (await s.call(method, path, { body })).status }).toEqual({ path, status: 401 });
      const res = await s.call(method, path, { cookie, body });
      expect({ path, ...res }).toEqual({ path, status: 403, body: { ok: false, error: "forbidden" } });
    }
    expect(s.mem.rows.size).toBe(0);
    expect(s.audit.rows).toHaveLength(0);
  });
});

describe("an admin manages notices", () => {
  test("create, read, change, delete: words cleaned, each change audited with ids only", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const made = await s.call("POST", "/admin/lists/notices", { cookie, body: notice() });
    expect(made.status).toBe(201);
    expect(made.body.item).toMatchObject({ titleJa: "通行止め", titleEn: null, routeId: ROUTE, published: false });
    const id = made.body.item.id as string;

    expect((await s.call("GET", `/admin/lists/notices/${id}`, { cookie })).body.item.titleJa).toBe("通行止め");

    const changed = await s.call("PATCH", `/admin/lists/notices/${id}`, { cookie, body: { updatedAt: made.body.item.updatedAt, published: true, titleEn: "Closed" } });
    expect(changed.status).toBe(200);
    expect(changed.body.item).toMatchObject({ published: true, titleEn: "Closed", titleJa: "通行止め" });

    expect((await s.call("DELETE", `/admin/lists/notices/${id}`, { cookie })).status).toBe(200);
    expect((await s.call("GET", `/admin/lists/notices/${id}`, { cookie })).status).toBe(404);
    expect((await s.call("DELETE", `/admin/lists/notices/${id}`, { cookie })).status).toBe(404);
    expect(s.audit.rows.map((r) => [r.action, r.targetType, r.targetId, r.actorUserId])).toEqual([
      ["notice.create", "notice", id, admin.id],
      ["notice.update", "notice", id, admin.id],
      ["notice.delete", "notice", id, admin.id],
    ]);
  });

  test("a stale updatedAt is a conflict and changes nothing", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const made = (await s.call("POST", "/admin/lists/notices", { cookie, body: notice() })).body.item;
    await s.call("PATCH", `/admin/lists/notices/${made.id}`, { cookie, body: { updatedAt: made.updatedAt, titleJa: "最初の保存" } });
    const late = await s.call("PATCH", `/admin/lists/notices/${made.id}`, { cookie, body: { updatedAt: made.updatedAt, titleJa: "遅い保存" } });
    expect(late).toEqual({ status: 409, body: { ok: false, error: "conflict" } });
    expect(s.mem.rows.get(made.id)!.titleJa).toBe("最初の保存");
  });

  test("changing only the last day still checks it against the checked day", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const made = (await s.call("POST", "/admin/lists/notices", { cookie, body: notice() })).body.item;
    const early = await s.call("PATCH", `/admin/lists/notices/${made.id}`, { cookie, body: { updatedAt: made.updatedAt, expiresOn: "2026-10-01" } });
    expect(early.status).toBe(422);
    expect(s.mem.rows.get(made.id)!.expiresOn).toBe("2026-10-31");
  });

  test("refused: no https source, blank Japanese, last day before the check, an unknown route, a missing field", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const post = (body: unknown) => s.call("POST", "/admin/lists/notices", { cookie, body });
    expect(await post(notice({ sourceUrl: "http://www.pref.nara.jp/" }))).toEqual({ status: 400, body: { ok: false, error: "invalid_source_url" } });
    expect((await post(notice({ titleJa: "   " }))).status).toBe(422);
    expect((await post(notice({ expiresOn: "2026-10-19" }))).status).toBe(422);
    expect((await post(notice({ routeId: crypto.randomUUID() }))).status).toBe(422);
    const { bodyJa: _gone, ...missing } = notice();
    expect((await post(missing)).status).toBe(422);
    expect(s.mem.rows.size).toBe(0);
  });

  test("pages of 50, newest first; the cursor gives the rest once each", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    for (let i = 0; i < 53; i++) await s.call("POST", "/admin/lists/notices", { cookie, body: notice({ titleJa: `n${i}` }) });
    const first = await s.call("GET", "/admin/lists/notices", { cookie });
    expect(first.body.items).toHaveLength(50);
    expect(first.body.items[0].titleJa).toBe("n52");
    const second = await s.call("GET", `/admin/lists/notices?cursor=${encodeURIComponent(first.body.next)}`, { cookie });
    expect(second.body.items.map((n: Json) => n.titleJa)).toEqual(["n2", "n1", "n0"]);
    expect(second.body.next).toBeNull();
    expect((await s.call("GET", "/admin/lists/notices?cursor=nonsense", { cookie })).status).toBe(422);
  });

  test("?q= searches the text fields and ?filter=field:value narrows by a field", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    for (const titleJa of ["通行止め", "崩落注意", "通行止め解除"]) await s.call("POST", "/admin/lists/notices", { cookie, body: notice({ titleJa }) });
    const found = await s.call("GET", `/admin/lists/notices?q=${encodeURIComponent("通行止め")}`, { cookie });
    expect(found.body.items.map((n: Json) => n.titleJa)).toEqual(["通行止め解除", "通行止め"]);
    expect((await s.call("GET", "/admin/lists/notices?q=nothing-like-this", { cookie })).body.items).toEqual([]);
    expect((await s.call("GET", `/admin/lists/notices?filter=routeId:${ROUTE}`, { cookie })).body.items).toHaveLength(3);
    expect((await s.call("GET", "/admin/lists/notices?filter=routeId:other", { cookie })).body.items).toEqual([]);
    expect((await s.call("GET", "/admin/lists/notices?filter=nope:x", { cookie })).body.items).toEqual([]);
  });
});

describe("visitors read published notices", () => {
  test("no login; drafts and notices past their last day (Japan time) are hidden; newest check first; no draft flag", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const add = (over: Record<string, unknown>) => s.call("POST", "/admin/lists/notices", { cookie, body: notice(over) });
    await add({ titleJa: "下書き", published: false });
    await add({ titleJa: "昨日まで", published: true, verifiedOn: "2026-10-01", expiresOn: "2026-10-20" }); // already over in Japan
    await add({ titleJa: "今日まで", published: true, verifiedOn: "2026-10-02", expiresOn: "2026-10-21" });
    await add({ titleJa: "期限なし", published: true, verifiedOn: "2026-10-05", expiresOn: null });
    const res = await s.call("GET", "/notices");
    expect(res.status).toBe(200);
    expect(res.body.notices.map((n: Json) => n.titleJa)).toEqual(["期限なし", "今日まで"]);
    expect(Object.keys(res.body.notices[0])).not.toContain("published");
    expect(Object.keys(res.body.notices[0])).not.toContain("updatedAt");
  });
});

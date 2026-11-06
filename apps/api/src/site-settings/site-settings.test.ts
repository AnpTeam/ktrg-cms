import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { Elysia } from "elysia";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemorySiteSettingsStore, createSiteSettingsService, MAP_STYLE, publicSettingsRoutes, siteSettingsRoutes, validLargeEntries } from "./site-settings";

const style = { base: "pale", terrain: "hillshade", terrainOpacity: 0.5, saturation: -0.2, contrast: 0 } as const;

describe("site settings", () => {
  test("nothing is set at first; a saved map style is read back and audited by setting only", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    expect(await svc.mapStyle()).toBeNull();
    await svc.setMapStyle("11111111-1111-4111-8111-111111111111", style);
    expect(await svc.mapStyle()).toEqual(style);
    expect(audit.rows.map((r) => [r.action, r.targetId])).toEqual([["site_setting.update", "00000000-0000-4000-8000-000000000001"]]);
    expect(JSON.stringify(audit.rows)).not.toContain("pale");
  });

  test("every home section is off until an admin turns it on, and the change is audited by setting only", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    expect(await svc.homeSections()).toEqual({ tourism: false });
    await svc.setHomeSections("11111111-1111-4111-8111-111111111111", { tourism: true });
    expect(await svc.homeSections()).toEqual({ tourism: true });
    expect(audit.rows.map((r) => r.targetId)).toEqual(["00000000-0000-4000-8000-000000000007"]);
  });

  test("the schema refuses an unknown base map and out-of-range numbers", () => {
    expect(Value.Check(MAP_STYLE, style)).toBe(true);
    expect(Value.Check(MAP_STYLE, { ...style, base: "satellite" })).toBe(false);
    expect(Value.Check(MAP_STYLE, { ...style, terrainOpacity: 1 })).toBe(false);
    expect(Value.Check(MAP_STYLE, { ...style, saturation: -2 })).toBe(false);
  });

  test("a page's own text is read back per page and audited by page only", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    const text = { ja: { title: "よくある質問", body: "## 質問\n答え" }, en: { title: "", body: "" } };
    expect(await svc.pageText("faq")).toBeNull();
    await svc.setPageText("11111111-1111-4111-8111-111111111111", "faq", text);
    expect(await svc.pageText("faq")).toEqual(text);
    expect(await svc.pageText("guide")).toBeNull();
    expect(audit.rows.map((r) => r.targetId)).toEqual(["00000000-0000-4000-8000-000000000002"]);
    expect(JSON.stringify(audit.rows)).not.toContain("答え");
  });
});

describe("who may change a page's text", () => {
  const user = (role: AuthUser["role"], n: number): AuthUser => ({ id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`, email: `${role}@example.com`, role, locale: "ja" });
  const people = { admin: user("admin", 1), editor: user("editor", 2), participant: user("participant", 3) };
  const page = (title: string) => ({ ja: { title, body: "## Q\nA" }, en: { title: "", body: "" } });

  async function setup() {
    const users = new Map(Object.values(people).map((u) => [u.id, { ...u }]));
    const session = createSessionService({ store: createMemorySessionStore(users).store });
    const audit = createMemoryAuditWriter();
    const siteSettings = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
    const services = { session, rateLimit, audit: audit.writer, siteSettings };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(siteSettingsRoutes(() => services, { secureCookies: false })).use(publicSettingsRoutes(() => siteSettings));
    const cookies = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([role, u]) => [role, `session=${(await session.create(users.get(u.id)!)).token}`])));
    const call = async (as: keyof typeof people | null, method: string, path: string, body?: unknown) => {
      const headers: Record<string, string> = { "content-type": "application/json", ...(as ? { cookie: cookies[as]! } : {}) };
      const res = await app.handle(new Request(`http://localhost/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line -- test helper
    };
    return { call, audit };
  }

  test("an editor changes the FAQ and how to play, and is refused the terms and the privacy policy", async () => {
    const { call } = await setup();
    expect((await call("editor", "PUT", "/admin/settings/pages/faq", page("FAQ"))).status).toBe(200);
    expect((await call("editor", "PUT", "/admin/settings/pages/guide", page("Guide"))).status).toBe(200);
    for (const key of ["terms", "privacy"]) {
      const refused = await call("editor", "PUT", `/admin/settings/pages/${key}`, page("x"));
      expect(refused).toMatchObject({ status: 403, body: { ok: false, error: "forbidden" } });
    }
    // The refused write saved nothing.
    expect((await call(null, "GET", "/pages/terms")).body.page).toBeNull();
  });

  test("an admin changes all four, and what is saved is what visitors read", async () => {
    const { call } = await setup();
    for (const key of ["faq", "guide", "terms", "privacy"]) expect((await call("admin", "PUT", `/admin/settings/pages/${key}`, page(key))).status).toBe(200);
    expect((await call(null, "GET", "/pages/privacy")).body.page.ja.title).toBe("privacy");
  });

  test("the list an editor reads leaves out the legal pages; an admin's has them", async () => {
    const { call } = await setup();
    expect(Object.keys((await call("editor", "GET", "/admin/settings/pages")).body.pages).sort()).toEqual(["faq", "guide", "home"]);
    expect(Object.keys((await call("admin", "GET", "/admin/settings/pages")).body.pages).sort()).toEqual(["faq", "guide", "home", "privacy", "terms"]);
  });

  test("a participant or a visitor who is not signed in changes and reads nothing here", async () => {
    const { call } = await setup();
    expect((await call("participant", "PUT", "/admin/settings/pages/faq", page("x"))).status).toBe(403);
    expect((await call("participant", "GET", "/admin/settings/pages")).status).toBe(403);
    expect((await call(null, "PUT", "/admin/settings/pages/faq", page("x"))).status).toBe(401);
  });

  const entries = [["[\"label\",\"symbol\"]", { "text-size": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 20], "text-color": "rgba(0,0,0,1)" }]];

  test("only an admin uploads the adjustments of the large-text map; anyone reads them; null goes back to the built-in ones", async () => {
    const { call } = await setup();
    expect((await call(null, "GET", "/settings/large-style")).body).toEqual({ ok: true, entries: null });
    expect((await call("editor", "PUT", "/admin/settings/large-style", { entries })).status).toBe(403);
    expect((await call(null, "PUT", "/admin/settings/large-style", { entries })).status).toBe(401);
    expect((await call("admin", "PUT", "/admin/settings/large-style", { entries })).status).toBe(200);
    expect((await call(null, "GET", "/settings/large-style")).body.entries).toEqual(entries);
    expect((await call("admin", "PUT", "/admin/settings/large-style", { entries: null })).status).toBe(200);
    expect((await call(null, "GET", "/settings/large-style")).body.entries).toBeNull();
  });

  test("a file the map could not read is refused, and nothing is saved", async () => {
    const { call, audit } = await setup();
    for (const bad of [[["k", { "fill-opacity": 1 }]], [["k", { "text-size": "big" }]], [["k", { "text-size": ["javascript", 1] }]], [["k", { "text-size": { nope: 1 } }]]]) {
      expect((await call("admin", "PUT", "/admin/settings/large-style", { entries: bad })).status).toBe(400);
    }
    expect((await call(null, "GET", "/settings/large-style")).body.entries).toBeNull();
    expect(audit.rows).toHaveLength(0);
  });

  test("validLargeEntries accepts numbers, colours, old stops and expressions, and refuses a huge file", () => {
    expect(validLargeEntries([["k", { "line-width": 2, "line-color": "red", "text-size": { stops: [[14, 12], [16, 24]] }, "line-dasharray": [2, 2] }]])).toBe(true);
    expect(validLargeEntries([["k", { "text-size": "red" }]])).toBe(false); // a word is only a colour
    expect(validLargeEntries(Array.from({ length: 2500 }, (_, i) => [`key-${i}-${"x".repeat(300)}`, { "text-size": 12 }] as [string, Record<string, unknown>]))).toBe(false);
  });
});

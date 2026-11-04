import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryVisitStore, createVisitService, MIN_CITY_VIEWS, optedOut, placeFrom, visitPath, visitRoutes } from "./visits";

const browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";
const from = (city: string, region = "29", country = "JP", extra: Record<string, string> = {}) =>
  new Headers({ "user-agent": browser, "x-vercel-ip-country": country, "x-vercel-ip-country-region": region, "x-vercel-ip-city": encodeURIComponent(city), ...extra });

describe("which pages are counted", () => {
  test("the landing page is counted as /, without language, query or trailing slash", () => {
    expect(visitPath("/")).toBe("/");
    expect(visitPath("/ja")).toBe("/");
    expect(visitPath("/en/?utm=x#top")).toBe("/");
    expect(visitPath("/ja/routes/abc/")).toBe("/routes/abc");
  });

  test("admin, sign-in and personal pages, and anything odd, are not counted", () => {
    for (const p of ["/admin", "/admin/routes/1", "/api/v1/me", "/login", "/ja/login", "/register", "/restore/abc", "/profile", "/settings", "/bookmarks", "x", "/a b", `/${"a".repeat(250)}`]) {
      expect(visitPath(p)).toBeNull();
    }
    // A page that only starts with the same letters is a different page.
    expect(visitPath("/profiles-of-guides")).toBe("/profiles-of-guides");
  });
});

describe("where a visit came from", () => {
  test("reads the country, region and city, decoding the city", () => {
    expect(placeFrom(from("御所市"), true)).toEqual({ country: "JP", region: "29", city: "御所市" });
    expect(placeFrom(new Headers(), true)).toEqual({ country: "", region: "", city: "" });
    expect(placeFrom(new Headers({ "x-vercel-ip-city": "%E0%A4%A" }), true).city).toBe("");
    // Both ways of writing the region: "27" and "JP-27".
    expect(placeFrom(from("大阪市", "JP-27"), true).region).toBe("27");
    expect(placeFrom(from("大阪市", "27"), true).region).toBe("27");
  });

  test("Cloudflare's location headers are read when Vercel's are absent", () => {
    const cf = (h: Record<string, string>) => new Headers({ "user-agent": browser, ...h });
    expect(placeFrom(cf({ "cf-ipcountry": "JP", "cf-region-code": "29", "cf-ipcity": "Gose" }), true)).toEqual({ country: "JP", region: "29", city: "Gose" });
    expect(placeFrom(cf({ "cf-ipcountry": "XX", "cf-ipcity": "Somewhere" }), true)).toEqual({ country: "", region: "", city: "" });
    expect(placeFrom(cf({ "cf-ipcountry": "T1" }), true)).toEqual({ country: "", region: "", city: "" });
    expect(placeFrom(cf({ "cf-ipcountry": "JP", "cf-ipcity": "100%" }), true).city).toBe("100%");
    // Vercel's win when both are there; neither is believed from an untrusted connection.
    expect(placeFrom(from("御所市", "29", "JP", { "cf-ipcountry": "US" }), true).country).toBe("JP");
    expect(placeFrom(cf({ "cf-ipcountry": "JP" }), false)).toEqual({ country: "", region: "", city: "" });
  });

  test("the headers are not believed when the proxy is not trusted", () => {
    expect(placeFrom(from("御所市"), false)).toEqual({ country: "", region: "", city: "" });
  });

  test("Do Not Track and Global Privacy Control opt out", () => {
    expect(optedOut(new Headers({ dnt: "1" }))).toBe(true);
    expect(optedOut(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(optedOut(new Headers())).toBe(false);
  });
});

describe("counting", () => {
  const setup = () => {
    const store = createMemoryVisitStore();
    return { store, svc: createVisitService({ store, now: () => new Date("2026-10-27T03:00:00Z") }) };
  };

  test("counts a view per day, place and page, and stores no more than that", async () => {
    const { svc } = setup();
    expect(await svc.record("/", from("御所市"), true)).toBe(true);
    await svc.record("/ja/", from("御所市"), true);
    await svc.record("/routes/1", from("大阪市", "27"), true);
    const s = await svc.summary("2026-10-27", "2026-10-27", null);
    expect(s.total).toBe(3);
    expect(s.byCountry).toEqual([{ country: "JP", views: 3 }]);
    expect(s.byRegion).toEqual([{ country: "JP", region: "29", views: 2 }, { country: "JP", region: "27", views: 1 }]);
    expect(s.topPages[0]).toEqual({ path: "/", views: 2 });
  });

  test("bots, a missing user agent and uncounted pages are not counted", async () => {
    const { svc } = setup();
    expect(await svc.record("/", from("x", "29", "JP", { "user-agent": "Googlebot/2.1" }), true)).toBe(false);
    expect(await svc.record("/", new Headers(), true)).toBe(false);
    expect(await svc.record("/profile", from("x"), true)).toBe(false);
    expect((await svc.summary("2026-10-27", "2026-10-27", null)).total).toBe(0);
  });

  test("a visitor who opted out is counted, with no place at all", async () => {
    const { svc } = setup();
    expect(await svc.record("/", from("御所市", "29", "JP", { dnt: "1" }), true)).toBe(true);
    expect(await svc.record("/", from("御所市", "29", "JP", { "sec-gpc": "1" }), true)).toBe(true);
    const s = await svc.summary("2026-10-27", "2026-10-27", null);
    expect(s.total).toBe(2);
    expect(s.byCountry).toEqual([{ country: "", views: 2 }]);
    expect(s.byRegion).toEqual([{ country: "", region: "", views: 2 }]);
    expect(s.byCity).toEqual([]);
  });

  test("a city is named only from the minimum number of views; the rest are counted, not named", async () => {
    const { svc } = setup();
    for (let i = 0; i < MIN_CITY_VIEWS; i++) await svc.record("/", from("御所市"), true);
    await svc.record("/", from("小さな町", "27"), true);
    await svc.record("/", from("", "27"), true);
    const s = await svc.summary("2026-10-27", "2026-10-27", null);
    expect(s.byCity).toEqual([{ country: "JP", region: "29", city: "御所市", views: MIN_CITY_VIEWS }]);
    expect(s.hiddenCityViews).toBe(2);
  });

  test("the range and the page prefix narrow what is summed", async () => {
    const { svc, store } = setup();
    await store.add("2026-10-01", { country: "JP", region: "29", city: "" }, "/routes/1");
    await svc.record("/routes/2", from("御所市"), true);
    await svc.record("/rallies/1", from("御所市"), true);
    expect((await svc.summary("2026-10-27", "2026-10-27", "/routes")).total).toBe(1);
    expect((await svc.summary("2026-10-01", "2026-10-27", "/routes")).total).toBe(2);
  });
});

describe("the routes", () => {
  const user = (role: AuthUser["role"], n: number): AuthUser => ({ id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`, email: `${role}@example.com`, role, locale: "ja" });
  const people = { admin: user("admin", 1), editor: user("editor", 2), participant: user("participant", 3) };

  async function setup(trust = true) {
    const users = new Map(Object.values(people).map((u) => [u.id, { ...u }]));
    const session = createSessionService({ store: createMemorySessionStore(users).store });
    const audit = createMemoryAuditWriter();
    const visits = createVisitService({ store: createMemoryVisitStore(), now: () => new Date("2026-10-27T03:00:00Z") });
    const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
    const services = { session, rateLimit, audit: audit.writer, visits };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(visitRoutes(() => services, { secureCookies: false, trustProxy: trust }));
    const cookies = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([role, u]) => [role, `session=${(await session.create(users.get(u.id)!)).token}`])));
    const call = async (as: keyof typeof people | null, method: string, path: string, body?: unknown, headers: Headers = from("御所市")) => {
      headers.set("content-type", "application/json");
      if (as) headers.set("cookie", cookies[as]!);
      const res = await app.handle(new Request(`http://localhost/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line -- test helper
    };
    return { call, audit };
  }

  test("anyone can send a view; editors and admins can read the counts; participants and visitors cannot", async () => {
    const { call } = await setup();
    expect((await call(null, "POST", "/visits", { path: "/routes/1" })).status).toBe(200);
    expect((await call("editor", "GET", "/admin/visits")).body).toMatchObject({ ok: true, total: 1, byCountry: [{ country: "JP", views: 1 }] });
    expect((await call("admin", "GET", "/admin/visits?path=/rallies")).body.total).toBe(0);
    expect((await call("participant", "GET", "/admin/visits")).status).toBe(403);
    expect((await call(null, "GET", "/admin/visits")).status).toBe(401);
  });

  test("without a trusted proxy every visit is from an unknown place", async () => {
    const { call } = await setup(false);
    await call(null, "POST", "/visits", { path: "/" });
    expect((await call("admin", "GET", "/admin/visits")).body.byCountry).toEqual([{ country: "", views: 1 }]);
  });

  test("a bad range is refused", async () => {
    const { call } = await setup();
    expect((await call("admin", "GET", "/admin/visits?from=2026-10-27&to=2026-10-01")).status).toBe(422);
    expect((await call("admin", "GET", "/admin/visits?from=2020-01-01&to=2026-10-27")).status).toBe(422);
    expect((await call("admin", "GET", "/admin/visits?from=yesterday")).status).toBe(422);
  });

  test("nothing about the visitor is saved or audited", async () => {
    const { call, audit } = await setup();
    await call(null, "POST", "/visits", { path: "/" });
    expect(audit.rows).toEqual([]);
  });
});

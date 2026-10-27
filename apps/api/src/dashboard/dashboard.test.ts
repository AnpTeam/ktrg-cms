import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemorySiteSettingsStore, createSiteSettingsService } from "../site-settings/site-settings";
import { createMemoryVisitStore, createVisitService } from "../visits/visits";
import { createDashboardService, createMemoryDashboardStore, dashboardRoutes, fillDays, NO_GOALS, startOfJstDay } from "./dashboard";

const now = () => new Date("2026-10-27T03:00:00Z"); // 12:00 on 27 October in Japan

describe("days", () => {
  test("every day of the range has a value, zero where there was none", () => {
    expect(fillDays("2026-10-25", "2026-10-27", [{ day: "2026-10-26", n: 4 }])).toEqual([
      { day: "2026-10-25", n: 0 },
      { day: "2026-10-26", n: 4 },
      { day: "2026-10-27", n: 0 },
    ]);
  });

  test("a Japan day starts at 15:00 the evening before, in UTC", () => {
    expect(startOfJstDay("2026-10-27").toISOString()).toBe("2026-10-26T15:00:00.000Z");
  });
});

describe("the overview", () => {
  const setup = (data = {}) => {
    const audit = createMemoryAuditWriter();
    const settings = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    const visitStore = createMemoryVisitStore();
    const visits = createVisitService({ store: visitStore, now });
    const store = createMemoryDashboardStore(data);
    return { svc: createDashboardService({ store, visits, settings, now, ttlMs: 0 }), visitStore, audit };
  };

  test("totals, what the range added, daily trends and the top region", async () => {
    const { svc, visitStore } = setup({
      totals: { stamps: 120, stampers: 30, signups: 45, completions: 6, flagged: 2 },
      since: { stamps: 20, signups: 5, completions: 1 },
      daily: [{ day: "2026-10-26", stamps: 8, signups: 2 }],
      origins: [{ origin: "nara", users: 20 }, { origin: null, users: 25 }],
      byRoute: [{ routeId: "r1", name: "葛城の道", stamps: 12 }],
    });
    await visitStore.add("2026-09-01", { country: "JP", region: "27", city: "" }, "/");
    await visitStore.add("2026-10-26", { country: "JP", region: "29", city: "" }, "/");
    await visitStore.add("2026-10-26", { country: "JP", region: "29", city: "" }, "/routes");
    const o = await svc.overview(7);
    expect(o.range).toEqual({ from: "2026-10-21", to: "2026-10-27", days: 7 });
    expect(o.stamps).toMatchObject({ total: 120, inRange: 20, stampers: 30, flagged: 2 });
    expect(o.stamps.daily).toHaveLength(7);
    expect(o.stamps.daily.find((d) => d.day === "2026-10-26")?.n).toBe(8);
    expect(o.signups).toMatchObject({ total: 45, inRange: 5 });
    expect(o.completions).toEqual({ total: 6, inRange: 1 });
    expect(o.visits).toMatchObject({ total: 3, inRange: 2, topRegion: { country: "JP", region: "29", views: 2 } });
    expect(o.stampsByRoute).toEqual([{ routeId: "r1", name: "葛城の道", stamps: 12 }]);
    expect(o.goals).toEqual(NO_GOALS);
  });

  test("goals are saved, read back, audited by setting only, and the next overview shows them", async () => {
    const { svc, audit } = setup();
    expect((await svc.overview(30)).goals).toEqual(NO_GOALS);
    await svc.setGoals("11111111-1111-4111-8111-111111111111", { visits: 10000, stamps: 500, signups: null, completions: 20 });
    expect((await svc.overview(30)).goals).toEqual({ visits: 10000, stamps: 500, signups: null, completions: 20 });
    expect(audit.rows.map((r) => [r.action, r.targetId])).toEqual([["site_setting.update", "00000000-0000-4000-8000-000000000006"]]);
    expect(JSON.stringify(audit.rows)).not.toContain("10000");
  });

  test("a recent answer is reused for a minute", async () => {
    let calls = 0;
    const store = { ...createMemoryDashboardStore(), totals: async () => (calls++, { stamps: 1, stampers: 1, signups: 1, completions: 0, flagged: 0 }) };
    const audit = createMemoryAuditWriter();
    const settings = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    const svc = createDashboardService({ store, visits: createVisitService({ store: createMemoryVisitStore(), now }), settings, now });
    await svc.overview(30);
    await svc.overview(30);
    expect(calls).toBe(1);
    await svc.overview(7);
    expect(calls).toBe(2);
  });
});

describe("the routes", () => {
  const user = (role: AuthUser["role"], n: number): AuthUser => ({ id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`, email: `${role}@example.com`, role, locale: "ja" });
  const people = { admin: user("admin", 1), editor: user("editor", 2), participant: user("participant", 3) };

  async function setup() {
    const users = new Map(Object.values(people).map((u) => [u.id, { ...u }]));
    const session = createSessionService({ store: createMemorySessionStore(users).store });
    const audit = createMemoryAuditWriter();
    const settings = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    const visits = createVisitService({ store: createMemoryVisitStore(), now });
    const dashboard = createDashboardService({ store: createMemoryDashboardStore(), visits, settings, now });
    const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
    const services = { session, rateLimit, audit: audit.writer, dashboard };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(dashboardRoutes(() => services, { secureCookies: false }));
    const cookies = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([role, u]) => [role, `session=${(await session.create(users.get(u.id)!)).token}`])));
    return async (as: keyof typeof people | null, method: string, path: string, body?: unknown) => {
      const headers: Record<string, string> = { "content-type": "application/json", ...(as ? { cookie: cookies[as]! } : {}) };
      const res = await app.handle(new Request(`http://localhost/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line -- test helper
    };
  }

  test("only an admin reads the dashboard or sets goals", async () => {
    const call = await setup();
    expect((await call("admin", "GET", "/admin/dashboard")).body).toMatchObject({ ok: true, range: { days: 30 } });
    expect((await call("admin", "GET", "/admin/dashboard?range=7")).body.range.days).toBe(7);
    for (const who of ["editor", "participant"] as const) {
      expect((await call(who, "GET", "/admin/dashboard")).status).toBe(403);
      expect((await call(who, "PUT", "/admin/dashboard/goals", NO_GOALS)).status).toBe(403);
    }
    expect((await call(null, "GET", "/admin/dashboard")).status).toBe(401);
  });

  test("a range outside 7, 30 and 90 and a goal that is not a whole number are refused", async () => {
    const call = await setup();
    expect((await call("admin", "GET", "/admin/dashboard?range=365")).status).toBe(422);
    expect((await call("admin", "PUT", "/admin/dashboard/goals", { ...NO_GOALS, stamps: 0 })).status).toBe(422);
    expect((await call("admin", "PUT", "/admin/dashboard/goals", { ...NO_GOALS, stamps: 1.5 })).status).toBe(422);
    expect((await call("admin", "PUT", "/admin/dashboard/goals", { visits: 5000, stamps: 500, signups: null, completions: null })).status).toBe(200);
    expect((await call("admin", "GET", "/admin/dashboard")).body.goals).toMatchObject({ visits: 5000, stamps: 500 });
  });
});

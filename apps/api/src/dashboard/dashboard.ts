import { Elysia, t, type Static } from "elysia";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { oneOf } from "../lib/schemas";
import type { SiteSettingsService } from "../site-settings/site-settings";
import type { VisitService } from "../visits/visits";

// The admin dashboard: four headline numbers (visits, stamps, sign-ups, rally completions), each against a goal an admin
// sets, with what was added in the chosen range and a small daily trend, plus which routes collect the most stamps.
// Everything is a count: no account, email or position appears in it.

export const RANGES = ["7", "30", "90"] as const;
export const DEFAULT_RANGE = "30";

/** The goals an admin sets for the four numbers; empty means no goal (the tile shows the number alone). */
const GOAL = t.Union([t.Integer({ minimum: 1, maximum: 100_000_000 }), t.Null()]);
export const GOALS = t.Object({ visits: GOAL, stamps: GOAL, signups: GOAL, completions: GOAL });
export type Goals = Static<typeof GOALS>;
export const NO_GOALS: Goals = { visits: null, stamps: null, signups: null, completions: null };

export interface Totals {
  /** Stamps not revoked. */
  stamps: number;
  /** People with at least one stamp. */
  stampers: number;
  signups: number;
  /** One per person and rally (a person who finished two rallies counts twice). */
  completions: number;
  /** Stamps waiting for a look (flagged, not revoked). */
  flagged: number;
}

export interface DashboardStore {
  totals(): Promise<Totals>;
  /** What was added from this moment on. */
  since(from: Date): Promise<{ stamps: number; signups: number; completions: number }>;
  /** Stamps and sign-ups per day (Japan time) from this moment on; days with none are left out. */
  daily(from: Date): Promise<{ day: string; stamps: number; signups: number }[]>;
  /** Sign-ups by where they say they are from (null: not said). */
  originSplit(): Promise<{ origin: string | null; users: number }[]>;
  /** The routes with the most stamps from this moment on, most first. */
  stampsByRoute(from: Date, limit: number): Promise<{ routeId: string; name: string | null; stamps: number }[]>;
}

export interface Tile {
  total: number;
  inRange: number;
  daily: { day: string; n: number }[];
}

export interface Overview {
  range: { from: string; to: string; days: number };
  goals: Goals;
  visits: Tile & { topRegion: { country: string; region: string; views: number } | null };
  stamps: Tile & { stampers: number; flagged: number };
  signups: Tile & { byOrigin: { origin: string | null; users: number }[] };
  completions: { total: number; inRange: number };
  stampsByRoute: { routeId: string; name: string | null; stamps: number }[];
}

const DAY_MS = 86_400_000;
const jstDay = (now: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** Midnight of a Japan day, as a moment. */
export const startOfJstDay = (day: string) => new Date(`${day}T00:00:00+09:00`);

/** One value per day from `from` to `to`, zero where the store had none. */
export function fillDays(from: string, to: string, rows: { day: string; n: number }[]): { day: string; n: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const out: { day: string; n: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ day: d, n: byDay.get(d) ?? 0 });
  return out;
}

export type DashboardService = ReturnType<typeof createDashboardService>;

export function createDashboardService(deps: { store: DashboardStore; visits: VisitService; settings: SiteSettingsService; now?: () => Date; ttlMs?: number; log?: (line: string) => void }) {
  const log = deps.log ?? console.error;
  const now = deps.now ?? (() => new Date());
  const ttl = deps.ttlMs ?? 60_000;
  // A minute is fresh enough for numbers like these, and it keeps a reload from running every query again.
  const cache = new Map<string, { at: number; value: Overview }>();

  return {
    async overview(days: number): Promise<Overview> {
      const to = jstDay(now());
      const hit = cache.get(`${days}:${to}`);
      if (hit && now().getTime() - hit.at < ttl) return hit.value;
      const from = addDays(to, -(days - 1));
      const start = startOfJstDay(from);
      // One group at a time: every store method already runs a few queries side by side, and starting all of them at once
      // (about 24) used up the whole connection pool, so every other admin page waited behind the dashboard and timed out.
      // A step slower than half a second is logged by name (no data in it), to find which query is the slow one.
      const step = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
        const t0 = Date.now();
        try {
          return await run();
        } finally {
          const ms = Date.now() - t0;
          if (ms > 500) log(`dashboard step slow: ${name} ${ms}ms`);
        }
      };
      // Never more than 4 queries at once: the pool holds 5, and a request that asked for more than that hung for the full 5 minutes.
      const goals = await step("goals", () => deps.settings.dashboardGoals());
      const totals = await step("totals", () => deps.store.totals());
      const added = await step("since", () => deps.store.since(start));
      const daily = await step("daily", () => deps.store.daily(start));
      const origins = await step("origins", () => deps.store.originSplit());
      const byRoute = await step("byRoute", () => deps.store.stampsByRoute(start, 10));
      const visitRange = await step("visitRange", () => deps.visits.summary(from, to, null));
      const visitAll = await step("visitAll", () => deps.visits.summary("2000-01-01", to, null));
      const visitDaily = await step("visitDaily", () => deps.visits.daily(from, to));
      const value: Overview = {
        range: { from, to, days },
        goals: goals ?? NO_GOALS,
        visits: { total: visitAll.total, inRange: visitRange.total, daily: fillDays(from, to, visitDaily.map((r) => ({ day: r.day, n: r.views }))), topRegion: visitRange.byRegion.find((r) => r.country !== "" && r.region !== "") ?? null },
        stamps: { total: totals.stamps, inRange: added.stamps, daily: fillDays(from, to, daily.map((r) => ({ day: r.day, n: r.stamps }))), stampers: totals.stampers, flagged: totals.flagged },
        signups: { total: totals.signups, inRange: added.signups, daily: fillDays(from, to, daily.map((r) => ({ day: r.day, n: r.signups }))), byOrigin: origins },
        completions: { total: totals.completions, inRange: added.completions },
        stampsByRoute: byRoute,
      };
      cache.set(`${days}:${to}`, { at: now().getTime(), value });
      return value;
    },
    goals: () => deps.settings.dashboardGoals().then((g) => g ?? NO_GOALS),
    async setGoals(actor: string, goals: Goals) {
      await deps.settings.setDashboardGoals(actor, goals);
      cache.clear();
    },
  };
}

/** In-memory numbers for tests and the dev page: whatever the test gives, the rest zero. */
export function createMemoryDashboardStore(data: Partial<{ totals: Totals; since: { stamps: number; signups: number; completions: number }; daily: { day: string; stamps: number; signups: number }[]; origins: { origin: string | null; users: number }[]; byRoute: { routeId: string; name: string | null; stamps: number }[] }> = {}): DashboardStore {
  return {
    totals: async () => data.totals ?? { stamps: 0, stampers: 0, signups: 0, completions: 0, flagged: 0 },
    since: async () => data.since ?? { stamps: 0, signups: 0, completions: 0 },
    daily: async () => data.daily ?? [],
    originSplit: async () => data.origins ?? [],
    stampsByRoute: async () => data.byRoute ?? [],
  };
}

export interface DashboardServices extends KitServices {
  dashboard: DashboardService;
}

export function dashboardRoutes(getServices: () => DashboardServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/dashboard", detail: { tags: ["Dashboard"] } })
    .use(plugins)
    .get("/", async ({ query }) => ({ ok: true as const, ...(await getServices().dashboard.overview(Number(query.range ?? DEFAULT_RANGE))) }), {
      auth: "dashboard.read",
      query: t.Object({ range: t.Optional(oneOf(RANGES)) }),
      detail: { summary: "The headline numbers, trends and goals" },
    })
    .put(
      "/goals",
      async ({ user, body }) => {
        await getServices().dashboard.setGoals(user.id, body);
        return { ok: true as const, goals: body };
      },
      { auth: "dashboard.read", rateLimit: { adminWriteUser: "user.id" }, body: GOALS, detail: { summary: "Set the goals the headline numbers are measured against" } },
    );
}

import { Elysia, t } from "elysia";
import { todayInJapan } from "../notices/notice-service";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";

// Where the visits come from: one count per day, per approximate place and page. The place is read from the headers the
// host adds (Vercel: the country, region and city of the connection) and the IP address itself is never read, kept or
// logged. Nothing here knows who the visitor is: no account, no cookie, no time of day. The privacy policy says so.

/** Cities with fewer views than this in the range are not listed by name: a single visitor could be picked out. */
export const MIN_CITY_VIEWS = 5;
export const MAX_RANGE_DAYS = 366;

export interface Place {
  country: string;
  region: string;
  city: string;
}

/** What the admin screen shows for a range of days (cities under MIN_CITY_VIEWS are only counted in `hiddenCityViews`). */
export interface VisitSummary {
  total: number;
  byCountry: { country: string; views: number }[];
  byRegion: { country: string; region: string; views: number }[];
  byCity: { country: string; region: string; city: string; views: number }[];
  hiddenCityViews: number;
  topPages: { path: string; views: number }[];
}

export interface VisitStore {
  /** Adds one view to the day's count for this place and page. */
  add(day: string, place: Place, path: string): Promise<void>;
  summary(from: string, to: string, pathPrefix: string | null): Promise<VisitSummary>;
  /** Views per day, for a range and optionally one page (a path prefix); days with none are left out. */
  daily(from: string, to: string, pathPrefix?: string | null): Promise<{ day: string; views: number }[]>;
}

// Pages that are about one person or one sign-in step are not counted at all.
const NOT_COUNTED = ["/admin", "/api", "/_next", "/login", "/register", "/restore", "/profile", "/settings", "/bookmarks", "/welcome"];
const LOCALE_PREFIX = /^\/(ja|en)(?=\/|$)/;

/** The page as counted: no language prefix, no query or fragment, no trailing slash; null when it is not to be counted. */
export function visitPath(raw: string): string | null {
  const noQuery = raw.split(/[?#]/)[0] ?? "";
  if (!noQuery.startsWith("/") || noQuery.length > 200 || /\s/.test(noQuery)) return null;
  const path = noQuery.replace(LOCALE_PREFIX, "").replace(/\/+$/, "") || "/";
  return NOT_COUNTED.some((p) => path === p || path.startsWith(`${p}/`)) ? null : path;
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|facebookexternalhit|curl|wget|python-requests|node-fetch/i;

/**
 * The approximate place of a connection from the host's headers. Only believed behind a proxy we trust (otherwise anyone
 * could send any place); the city arrives percent-encoded. A missing piece is "" (unknown).
 */
export function placeFrom(headers: Headers, trusted: boolean): Place {
  if (!trusted) return { country: "", region: "", city: "" };
  const upper = (v: string | null, max: number) => (v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);
  let city = headers.get("x-vercel-ip-city") ?? "";
  try {
    city = decodeURIComponent(city);
  } catch {
    city = "";
  }
  // The region is the part after the country ("27"); some sources send the whole code ("JP-27").
  const region = (headers.get("x-vercel-ip-country-region") ?? "").split("-").pop() ?? "";
  return { country: upper(headers.get("x-vercel-ip-country"), 2), region: upper(region, 3), city: city.trim().slice(0, 100) };
}

/** A visitor who asks not to be tracked (Do Not Track, Global Privacy Control) is counted, but with no place at all. */
export const optedOut = (headers: Headers) => headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";

export type VisitService = ReturnType<typeof createVisitService>;

export function createVisitService(deps: { store: VisitStore; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    /** Counts one page view; returns false when it was not counted (a bot, a page that is not counted). An opt-out is counted with no place. */
    async record(path: string, headers: Headers, trusted: boolean): Promise<boolean> {
      const counted = visitPath(path);
      const agent = headers.get("user-agent") ?? "";
      if (counted === null || agent === "" || BOT.test(agent)) return false;
      await deps.store.add(todayInJapan(now()), optedOut(headers) ? { country: "", region: "", city: "" } : placeFrom(headers, trusted), counted);
      return true;
    },
    summary: (from: string, to: string, pathPrefix: string | null) => deps.store.summary(from, to, pathPrefix),
    daily: (from: string, to: string, pathPrefix: string | null = null) => deps.store.daily(from, to, pathPrefix),
    today: () => todayInJapan(now()),
  };
}

/** In-memory counts for tests and the dev page. */
export function createMemoryVisitStore(): VisitStore {
  const rows = new Map<string, { day: string; place: Place; path: string; views: number }>();
  return {
    async add(day, place, path) {
      const key = JSON.stringify([day, place.country, place.region, place.city, path]);
      const row = rows.get(key) ?? { day, place, path, views: 0 };
      row.views++;
      rows.set(key, row);
    },
    async daily(from, to, prefix = null) {
      const m = new Map<string, number>();
      for (const r of rows.values()) if (r.day >= from && r.day <= to && (prefix === null || r.path.startsWith(prefix))) m.set(r.day, (m.get(r.day) ?? 0) + r.views);
      return [...m].map(([day, views]) => ({ day, views })).sort((a, b) => a.day.localeCompare(b.day));
    },
    async summary(from, to, prefix) {
      const inRange = [...rows.values()].filter((r) => r.day >= from && r.day <= to && (prefix === null || r.path.startsWith(prefix)));
      const sum = <K extends string>(key: (r: (typeof inRange)[number]) => Record<K, string>) => {
        const m = new Map<string, { k: Record<K, string>; views: number }>();
        for (const r of inRange) {
          const k = key(r);
          const id = JSON.stringify(k);
          const e = m.get(id) ?? { k, views: 0 };
          e.views += r.views;
          m.set(id, e);
        }
        return [...m.values()].map((e) => ({ ...e.k, views: e.views })).sort((a, b) => b.views - a.views);
      };
      const cities = sum((r) => ({ country: r.place.country, region: r.place.region, city: r.place.city }));
      return {
        total: inRange.reduce((n, r) => n + r.views, 0),
        byCountry: sum((r) => ({ country: r.place.country })),
        byRegion: sum((r) => ({ country: r.place.country, region: r.place.region })),
        byCity: cities.filter((c) => c.views >= MIN_CITY_VIEWS && c.city !== ""),
        hiddenCityViews: cities.filter((c) => c.views < MIN_CITY_VIEWS || c.city === "").reduce((n, c) => n + c.views, 0),
        topPages: sum((r) => ({ path: r.path })).slice(0, 20),
      };
    },
  };
}

export interface VisitServices extends KitServices {
  visits: VisitService;
}

const DAY = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

export function visitRoutes(getServices: () => VisitServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ detail: { tags: ["Visits"] } })
    .use(plugins)
    // Public: the page calls this once per page view. The answer says nothing about whether it was counted.
    .post(
      "/visits",
      async ({ body, request }) => {
        await getServices().visits.record(body.path, request.headers, opts.trustProxy ?? false);
        return { ok: true as const };
      },
      { rateLimit: { visitIp: "ip" }, body: t.Object({ path: t.String({ maxLength: 300 }) }), detail: { summary: "Count one page view (approximate region only; no IP address is kept)" } },
    )
    // Admin: where the views came from, for a range of days and optionally one page (a path prefix).
    .get(
      "/admin/visits",
      async ({ query, set }) => {
        const svc = getServices().visits;
        const to = query.to ?? svc.today();
        const from = query.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
        const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
        if (!(days >= 0) || days > MAX_RANGE_DAYS) return fail(set, 422, "validation_failed");
        const path = query.path ?? null;
        const [summary, daily] = await Promise.all([svc.summary(from, to, path), svc.daily(from, to, path)]);
        return { ok: true as const, from, to, minCityViews: MIN_CITY_VIEWS, ...summary, daily };
      },
      { auth: "visit.read", query: t.Object({ from: t.Optional(DAY), to: t.Optional(DAY), path: t.Optional(t.String({ maxLength: 200 })) }), detail: { summary: "Page views by place" } },
    );
}

import { Elysia, t, type Static } from "elysia";
import type { AuditWriter } from "../audit/audit-log";
import { fail } from "../auth/http";
import { can } from "../auth/permissions";
import { oneOf } from "../lib/schemas";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";

// Settings for the whole site, kept as one named value each. Changing one changes the live site at once, so only
// an admin may (`site.manage`), every change is audited (the key only, never the value), and the screen says so.
// The first one is the look of the map every visitor sees.

export const BASE_LAYERS = ["std", "pale", "blank", "photo"] as const;
export const TERRAIN_LAYERS = ["hillshade", "relief"] as const;

/**
 * How the visitors' map looks: the base map (GSI standard, pale, blank, photo), the terrain shading that the terrain
 * button adds, and two calming adjustments of the base tiles (saturation: colour strength, contrast).
 */
export const MAP_STYLE = t.Object({
  base: oneOf(BASE_LAYERS),
  terrain: oneOf(TERRAIN_LAYERS),
  terrainOpacity: t.Number({ minimum: 0.2, maximum: 0.8 }),
  saturation: t.Number({ minimum: -1, maximum: 0.5 }),
  contrast: t.Number({ minimum: -0.5, maximum: 0.5 }),
});
export type MapStyleSetting = Static<typeof MAP_STYLE>;

/**
 * Which optional sections of the home page are switched on. Off until an admin turns one on, so a section that has no
 * pages behind it yet (the tourism cards) is not shown to visitors by accident.
 */
export const HOME_SECTIONS = t.Object({ tourism: t.Boolean() });
export type HomeSections = Static<typeof HOME_SECTIONS>;
export const defaultHomeSections: HomeSections = { tourism: false };

export const SETTING_KEYS = { mapStyle: "map_style", dashboardGoals: "dashboard_goals", homeSections: "home_sections" } as const;

/**
 * The fixed pages whose text an editor can replace (管理 > ページの文章): the FAQ and how to play, and the terms and
 * the privacy policy. Until a page has its own text, the page built into the app is shown. The legal two are for an
 * admin only (`site.manage`).
 */
export const PAGE_KEYS = ["faq", "guide", "terms", "privacy"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export const LEGAL_PAGES: readonly PageKey[] = ["terms", "privacy"];
const PAGE_LANG = t.Object({ title: t.String({ maxLength: 200 }), body: t.String({ maxLength: 30000 }) });
/** A language left blank (no title, no body) keeps showing the page built into the app. */
export const PAGE_TEXT = t.Object({ ja: PAGE_LANG, en: PAGE_LANG });
export type PageText = Static<typeof PAGE_TEXT>;
const pageSetting = (key: PageKey) => `page:${key}`;

export interface SiteSettingsStore {
  /** The saved value of a setting, or null when it was never set. */
  get(key: string): Promise<unknown | null>;
  /** Saves it and writes the audit row (the key only) in the same step. */
  set(actor: string, key: string, value: unknown): Promise<void>;
}

/** What the dashboard keeps as its goals (validated by GOALS in dashboard/dashboard.ts). */
export type DashboardGoals = { visits: number | null; stamps: number | null; signups: number | null; completions: number | null };

export type SiteSettingsService = ReturnType<typeof createSiteSettingsService>;

export function createSiteSettingsService(deps: { store: SiteSettingsStore }) {
  return {
    /** The saved map style, or null (the site then uses its built-in default). */
    mapStyle: async () => (await deps.store.get(SETTING_KEYS.mapStyle)) as MapStyleSetting | null,
    setMapStyle: (actor: string, value: MapStyleSetting) => deps.store.set(actor, SETTING_KEYS.mapStyle, value),
    /** The goals the dashboard measures its four numbers against (see dashboard/), or null when none were set. */
    dashboardGoals: async () => (await deps.store.get(SETTING_KEYS.dashboardGoals)) as DashboardGoals | null,
    setDashboardGoals: (actor: string, value: DashboardGoals) => deps.store.set(actor, SETTING_KEYS.dashboardGoals, value),
    /** Which optional home page sections are on; every one is off until set. */
    homeSections: async (): Promise<HomeSections> => ({ ...defaultHomeSections, ...(((await deps.store.get(SETTING_KEYS.homeSections)) as Partial<HomeSections> | null) ?? {}) }),
    setHomeSections: (actor: string, value: HomeSections) => deps.store.set(actor, SETTING_KEYS.homeSections, value),
    pageText: async (key: PageKey) => (await deps.store.get(pageSetting(key))) as PageText | null,
    setPageText: (actor: string, key: PageKey, value: PageText) => deps.store.set(actor, pageSetting(key), value),
  };
}

/** The audit log wants a UUID as the target: each setting has a fixed one (the log records which setting changed, never its value). */
export const SETTING_TARGET: Record<string, string> = {
  [SETTING_KEYS.mapStyle]: "00000000-0000-4000-8000-000000000001",
  "page:faq": "00000000-0000-4000-8000-000000000002",
  "page:guide": "00000000-0000-4000-8000-000000000003",
  "page:terms": "00000000-0000-4000-8000-000000000004",
  "page:privacy": "00000000-0000-4000-8000-000000000005",
  [SETTING_KEYS.dashboardGoals]: "00000000-0000-4000-8000-000000000006",
  [SETTING_KEYS.homeSections]: "00000000-0000-4000-8000-000000000007",
};

export const SETTING_AUDIT = "site_setting.update" as const;

/** In-memory settings for tests and the dev page. */
export function createMemorySiteSettingsStore(audit: AuditWriter): SiteSettingsStore {
  const values = new Map<string, unknown>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(actor, key, value) {
      values.set(key, value);
      await audit.record({ actorUserId: actor, action: SETTING_AUDIT, targetId: SETTING_TARGET[key] ?? null });
    },
  };
}

export interface SiteSettingsServices extends KitServices {
  siteSettings: SiteSettingsService;
}

/** Admin: read and change the settings (`site.manage`). */
export function siteSettingsRoutes(getServices: () => SiteSettingsServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/settings", detail: { tags: ["Site settings"] } })
    .use(plugins)
    .get("/", async () => ({ ok: true as const, mapStyle: await getServices().siteSettings.mapStyle(), homeSections: await getServices().siteSettings.homeSections() }), { auth: "site.manage" })
    .put(
      "/home-sections",
      async ({ user, body }) => {
        await getServices().siteSettings.setHomeSections(user.id, body);
        return { ok: true as const, homeSections: body };
      },
      { auth: "site.manage", rateLimit: { adminWriteUser: "user.id" }, body: HOME_SECTIONS },
    )
    .put(
      "/map-style",
      async ({ user, body }) => {
        await getServices().siteSettings.setMapStyle(user.id, body);
        return { ok: true as const, mapStyle: body };
      },
      { auth: "site.manage", rateLimit: { adminWriteUser: "user.id" }, body: MAP_STYLE },
    )
    // The pages' own text. Editors may change the FAQ and how to play; the terms and the privacy policy are for an admin.
    .get(
      "/pages",
      async ({ user }) => {
        const svc = getServices().siteSettings;
        const pages: Partial<Record<PageKey, PageText | null>> = {};
        for (const key of PAGE_KEYS) if (!LEGAL_PAGES.includes(key) || can(user.role, "site.manage")) pages[key] = await svc.pageText(key);
        return { ok: true as const, pages };
      },
      { auth: "notice.manage" },
    )
    .put(
      "/pages/:key",
      async ({ user, params, body, set }) => {
        if (LEGAL_PAGES.includes(params.key) && !can(user.role, "site.manage")) return fail(set, 403, "forbidden");
        await getServices().siteSettings.setPageText(user.id, params.key, body);
        return { ok: true as const, page: body };
      },
      { auth: "notice.manage", rateLimit: { adminWriteUser: "user.id" }, params: t.Object({ key: oneOf(PAGE_KEYS) }), body: PAGE_TEXT },
    );
}

/** What visitors' pages read (no login): the map style, or null for the default. */
export function publicSettingsRoutes(getSettings: () => SiteSettingsService) {
  return new Elysia({ detail: { tags: ["Content"] } })
    .get("/settings", async () => ({ ok: true as const, mapStyle: await getSettings().mapStyle(), homeSections: await getSettings().homeSections() }))
    .get("/pages/:key", async ({ params }) => ({ ok: true as const, page: await getSettings().pageText(params.key) }), { params: t.Object({ key: oneOf(PAGE_KEYS) }) });
}

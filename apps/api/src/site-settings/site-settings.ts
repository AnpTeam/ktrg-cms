import { Elysia, t, type Static } from "elysia";
import type { AuditWriter } from "../audit/audit-log";
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
  base: t.UnionEnum([...BASE_LAYERS]),
  terrain: t.UnionEnum([...TERRAIN_LAYERS]),
  terrainOpacity: t.Number({ minimum: 0.2, maximum: 0.8 }),
  saturation: t.Number({ minimum: -1, maximum: 0.5 }),
  contrast: t.Number({ minimum: -0.5, maximum: 0.5 }),
});
export type MapStyleSetting = Static<typeof MAP_STYLE>;

export const SETTING_KEYS = { mapStyle: "map_style" } as const;

export interface SiteSettingsStore {
  /** The saved value of a setting, or null when it was never set. */
  get(key: string): Promise<unknown | null>;
  /** Saves it and writes the audit row (the key only) in the same step. */
  set(actor: string, key: string, value: unknown): Promise<void>;
}

export type SiteSettingsService = ReturnType<typeof createSiteSettingsService>;

export function createSiteSettingsService(deps: { store: SiteSettingsStore }) {
  return {
    /** The saved map style, or null (the site then uses its built-in default). */
    mapStyle: async () => (await deps.store.get(SETTING_KEYS.mapStyle)) as MapStyleSetting | null,
    setMapStyle: (actor: string, value: MapStyleSetting) => deps.store.set(actor, SETTING_KEYS.mapStyle, value),
  };
}

/** The audit log wants a UUID as the target: each setting has a fixed one (the log records which setting changed, never its value). */
export const SETTING_TARGET: Record<string, string> = { [SETTING_KEYS.mapStyle]: "00000000-0000-4000-8000-000000000001" };

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
    .get("/", async () => ({ ok: true as const, mapStyle: await getServices().siteSettings.mapStyle() }), { auth: "site.manage" })
    .put(
      "/map-style",
      async ({ user, body }) => {
        await getServices().siteSettings.setMapStyle(user.id, body);
        return { ok: true as const, mapStyle: body };
      },
      { auth: "site.manage", rateLimit: { adminWriteUser: "user.id" }, body: MAP_STYLE },
    );
}

/** What visitors' pages read (no login): the map style, or null for the default. */
export function publicSettingsRoutes(getSettings: () => SiteSettingsService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get("/settings", async () => ({ ok: true as const, mapStyle: await getSettings().mapStyle() }));
}

// How the trail map looks. One setting set, shared by every map, kept in a cookie so the server
// can render with it. For now only developers change it (the settings page is development-only);
// the visitor just gets the defaults. Pure functions, unit-tested.

/** Base map: GSI standard (colour, roads and names) or pale (a quieter, lighter version). */
export const baseLayers = ["std", "pale"] as const;
/**
 * What the visitor's "terrain" button adds on top:
 * hillshade = soft light-and-shadow that shows the shape of the mountains (no colour change);
 * relief = GSI's 色別標高図: a colour for each height (green low, brown high), which tints the map.
 */
export const terrainLayers = ["hillshade", "relief"] as const;
/** What to do to the (always light) tiles in dark mode. */
export const darkTreatments = ["none", "dim", "invert"] as const;

export type BaseLayer = (typeof baseLayers)[number];
export type TerrainLayer = (typeof terrainLayers)[number];
export type DarkTreatment = (typeof darkTreatments)[number];

export interface MapSettings {
  base: BaseLayer;
  terrain: TerrainLayer;
  /** How strong the terrain overlay is, 0.2 to 0.8. */
  terrainOpacity: number;
  dark: DarkTreatment;
}

export const defaultMapSettings: MapSettings = {
  base: "std",
  terrain: "hillshade",
  terrainOpacity: 0.5,
  dark: "none", // plain tiles: dimmed or inverted maps were judged too dark to read outdoors
};

export const mapSettingsCookie = "map_style";

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Anything unknown or out of range falls back to the default, field by field. */
export function sanitizeMapSettings(value: unknown): MapSettings {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const opacity = typeof v.terrainOpacity === "number" && Number.isFinite(v.terrainOpacity) ? v.terrainOpacity : defaultMapSettings.terrainOpacity;
  return {
    base: pick(baseLayers, v.base, defaultMapSettings.base),
    terrain: pick(terrainLayers, v.terrain, defaultMapSettings.terrain),
    terrainOpacity: Math.min(0.8, Math.max(0.2, Math.round(opacity * 100) / 100)),
    dark: pick(darkTreatments, v.dark, defaultMapSettings.dark),
  };
}

/** The settings from the cookie's value (what the server reads). */
export function parseMapSettings(raw: string | null | undefined): MapSettings {
  if (!raw) return defaultMapSettings;
  try {
    return sanitizeMapSettings(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return defaultMapSettings;
  }
}

export function mapSettingsCookieString(settings: MapSettings, secure: boolean): string {
  const value = encodeURIComponent(JSON.stringify(sanitizeMapSettings(settings)));
  return `${mapSettingsCookie}=${value}; Path=/; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`;
}

export function mapSettingsResetCookieString(secure: boolean): string {
  return `${mapSettingsCookie}=; Path=/; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

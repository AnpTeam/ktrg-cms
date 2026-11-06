// How the trail map looks. One setting set, shared by every map and every visitor: an admin chooses it in
// 管理 > サイト全体の設定 (kept in the database, read from the API), and the built-in default below applies until then.
// Pure functions, unit-tested.

/**
 * Base map (all GSI tiles): standard (colour, roads, names), pale (the same, quieter and lighter), blank (coastlines and
 * boundaries only), photo (aerial photographs) or large (vector map with bigger text; not raster, so the calming
 * adjustments below do not apply to it).
 */
export const baseLayers = ["std", "pale", "blank", "photo", "large"] as const;
/**
 * What the visitor's "terrain" button adds on top:
 * hillshade = soft light-and-shadow that shows the shape of the mountains (no colour change);
 * relief = GSI's 色別標高図: a colour for each height (green low, brown high), which tints the map.
 */
export const terrainLayers = ["hillshade", "relief"] as const;

export type BaseLayer = (typeof baseLayers)[number];
export type TerrainLayer = (typeof terrainLayers)[number];

export interface MapSettings {
  base: BaseLayer;
  terrain: TerrainLayer;
  /** How strong the terrain overlay is, 0.2 to 0.8. */
  terrainOpacity: number;
  /** Colour strength of the base tiles, -1 (grey) to 0.5 (vivid); 0 leaves them as GSI draws them. */
  saturation: number;
  /** Contrast of the base tiles, -0.5 (flat) to 0.5 (hard); 0 leaves them as they are. */
  contrast: number;
  /** The vector map only: names, icons and lines drawn this many times the size its style gives (0.8 to 2; 1 = as is). */
  labelScale: number;
  iconScale: number;
  lineScale: number;
}

/** The look until an admin chooses one: the quieter pale map. */
export const defaultMapSettings: MapSettings = {
  base: "pale",
  terrain: "hillshade",
  terrainOpacity: 0.5,
  saturation: 0,
  contrast: 0,
  labelScale: 1,
  iconScale: 1,
  lineScale: 1,
};

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value * 100) / 100)) : fallback;

/** Anything unknown or out of range falls back to the default, field by field. */
export function sanitizeMapSettings(value: unknown): MapSettings {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    base: pick(baseLayers, v.base, defaultMapSettings.base),
    terrain: pick(terrainLayers, v.terrain, defaultMapSettings.terrain),
    terrainOpacity: clamp(v.terrainOpacity, 0.2, 0.8, defaultMapSettings.terrainOpacity),
    saturation: clamp(v.saturation, -1, 0.5, defaultMapSettings.saturation),
    contrast: clamp(v.contrast, -0.5, 0.5, defaultMapSettings.contrast),
    labelScale: clamp(v.labelScale, 0.8, 2, defaultMapSettings.labelScale),
    iconScale: clamp(v.iconScale, 0.8, 2, defaultMapSettings.iconScale),
    lineScale: clamp(v.lineScale, 0.8, 2, defaultMapSettings.lineScale),
  };
}

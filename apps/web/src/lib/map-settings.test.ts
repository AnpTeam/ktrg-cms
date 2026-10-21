import { describe, expect, test } from "bun:test";
import { defaultMapSettings, sanitizeMapSettings } from "./map-settings";

describe("map settings", () => {
  test("the defaults: the quiet pale map, hillshade terrain, tiles as GSI draws them", () => {
    expect(defaultMapSettings).toEqual({ base: "pale", terrain: "hillshade", terrainOpacity: 0.5, saturation: 0, contrast: 0, dark: "none" });
  });

  test("each field falls back on its own, and the numbers are kept in range", () => {
    expect(sanitizeMapSettings({ base: "photo", terrain: "purple", terrainOpacity: 5, saturation: -3, contrast: 0.3 })).toEqual({
      base: "photo",
      terrain: "hillshade",
      terrainOpacity: 0.8,
      saturation: -1,
      contrast: 0.3,
      dark: "none",
    });
    expect(sanitizeMapSettings({ terrainOpacity: -1 }).terrainOpacity).toBe(0.2);
    expect(sanitizeMapSettings({ terrainOpacity: "high" }).terrainOpacity).toBe(0.5);
    expect(sanitizeMapSettings({ base: "satellite" }).base).toBe("pale");
  });

  test("nothing, or something that is not a setting, gives the defaults", () => {
    expect(sanitizeMapSettings(null)).toEqual(defaultMapSettings);
    expect(sanitizeMapSettings("pale")).toEqual(defaultMapSettings);
  });
});

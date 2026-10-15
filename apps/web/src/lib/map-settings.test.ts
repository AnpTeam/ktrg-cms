import { describe, expect, test } from "bun:test";
import {
  defaultMapSettings,
  mapSettingsCookieString,
  mapSettingsResetCookieString,
  parseMapSettings,
  sanitizeMapSettings,
} from "./map-settings";

describe("map settings", () => {
  test("the defaults: standard map, hillshade terrain, plain tiles in dark", () => {
    expect(defaultMapSettings).toEqual({ base: "std", terrain: "hillshade", terrainOpacity: 0.5, dark: "none" });
  });

  test("a missing or broken cookie gives the defaults", () => {
    expect(parseMapSettings(undefined)).toEqual(defaultMapSettings);
    expect(parseMapSettings("")).toEqual(defaultMapSettings);
    expect(parseMapSettings("not json")).toEqual(defaultMapSettings);
    expect(parseMapSettings("%E0%A4%A")).toEqual(defaultMapSettings);
  });

  test("each field falls back on its own, and the opacity is kept in range", () => {
    expect(sanitizeMapSettings({ base: "pale", terrain: "purple", terrainOpacity: 5, dark: "dim" })).toEqual({
      base: "pale",
      terrain: "hillshade",
      terrainOpacity: 0.8,
      dark: "dim",
    });
    expect(sanitizeMapSettings({ terrainOpacity: -1 }).terrainOpacity).toBe(0.2);
    expect(sanitizeMapSettings({ terrainOpacity: "high" }).terrainOpacity).toBe(0.5);
    expect(sanitizeMapSettings(null)).toEqual(defaultMapSettings);
  });

  test("what is written can be read back", () => {
    const settings = { base: "pale", terrain: "relief", terrainOpacity: 0.65, dark: "invert" } as const;
    const cookie = mapSettingsCookieString(settings, false);
    const value = cookie.split(";")[0]!.slice("map_style=".length);
    expect(parseMapSettings(value)).toEqual(settings);
    expect(cookie).toContain("Max-Age=31536000");
    expect(mapSettingsCookieString(settings, true)).toContain("; Secure");
  });

  test("reset removes the cookie", () => {
    expect(mapSettingsResetCookieString(false)).toBe("map_style=; Path=/; SameSite=Lax; Max-Age=0");
  });
});

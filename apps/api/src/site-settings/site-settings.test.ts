import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemorySiteSettingsStore, createSiteSettingsService, MAP_STYLE } from "./site-settings";

const style = { base: "pale", terrain: "hillshade", terrainOpacity: 0.5, saturation: -0.2, contrast: 0 } as const;

describe("site settings", () => {
  test("nothing is set at first; a saved map style is read back and audited by setting only", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createSiteSettingsService({ store: createMemorySiteSettingsStore(audit.writer) });
    expect(await svc.mapStyle()).toBeNull();
    await svc.setMapStyle("11111111-1111-4111-8111-111111111111", style);
    expect(await svc.mapStyle()).toEqual(style);
    expect(audit.rows.map((r) => [r.action, r.targetId])).toEqual([["site_setting.update", "00000000-0000-4000-8000-000000000001"]]);
    expect(JSON.stringify(audit.rows)).not.toContain("pale");
  });

  test("the schema refuses an unknown base map and out-of-range numbers", () => {
    expect(Value.Check(MAP_STYLE, style)).toBe(true);
    expect(Value.Check(MAP_STYLE, { ...style, base: "satellite" })).toBe(false);
    expect(Value.Check(MAP_STYLE, { ...style, terrainOpacity: 1 })).toBe(false);
    expect(Value.Check(MAP_STYLE, { ...style, saturation: -2 })).toBe(false);
  });
});

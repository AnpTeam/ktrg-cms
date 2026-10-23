import { expect, test } from "bun:test";
import { accessColor, accessIconSvg, accessTypes, isAccessType, newAccessPoint } from "./access-points";

test("every kind of way to get there has a colour and a picture", () => {
  for (const type of accessTypes) {
    expect(accessColor[type]).toMatch(/^#[0-9a-f]{6}$/);
    expect(accessIconSvg[type].length).toBeGreaterThan(20);
  }
});

test("isAccessType and newAccessPoint", () => {
  expect(isAccessType("ferry")).toBe(true);
  expect(isAccessType("plane")).toBe(false);
  expect(newAccessPoint("bus")).toEqual({ type: "bus", nameJa: "", nameEn: null, noteJa: null, noteEn: null });
});

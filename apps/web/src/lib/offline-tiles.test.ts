import { expect, test } from "bun:test";
import { tileUrls } from "./offline-tiles";

const area = { lat: 34.45, lng: 135.65, widthM: 4000, heightM: 4000, verified: true };

test("covers the area at each zoom and respects the limit", () => {
  const all = tileUrls(area, "t/{z}/{x}/{y}", 11, 15, 10_000);
  expect(all.some((u) => u.startsWith("t/15/"))).toBe(true);
  expect(all.length).toBeGreaterThan(20);
  expect(tileUrls(area, "t/{z}/{x}/{y}", 11, 15, 40).length).toBeLessThanOrEqual(40);
  expect(tileUrls(area, "t/{z}/{x}/{y}", 11, 11, 10)[0]).toBe("t/11/1795/814");
});

import { describe, expect, test } from "bun:test";
import type { AccessPoint } from "../access-points";
import { nearerEnd, sortAccess, transitLink } from "./transit-links";

const station = (over: Partial<AccessPoint> = {}): AccessPoint => ({ type: "train", nameJa: "加太駅", nameEn: null, noteJa: null, noteEn: null, lat: 34.2, lng: 135.1, checked: true, source: "x", ...over });

describe("transitLink", () => {
  test("carries the station's position, in transit mode for Google", () => {
    expect(transitLink(station(), "google")).toBe("https://www.google.com/maps/dir/?api=1&destination=34.2,135.1&travelmode=transit");
    expect(transitLink(station(), "yahoo")).toBe("https://map.yahoo.co.jp/place?lat=34.2&lon=135.1&zoom=17");
  });

  test("no link without a checked position", () => {
    expect(transitLink(station({ checked: false }), "google")).toBeNull();
    expect(transitLink(station({ lat: null, lng: null }), "yahoo")).toBeNull();
    expect(transitLink({ ...station(), checked: undefined }, "google")).toBeNull();
  });
});

describe("which end, and the order", () => {
  const ends = { start: { lat: 34.2, lng: 135.0 }, end: { lat: 34.2, lng: 135.2 } };

  test("the nearer end of the course", () => {
    expect(nearerEnd(ends, { lat: 34.2, lng: 135.04 })).toBe("start");
    expect(nearerEnd(ends, { lat: 34.2, lng: 135.19 })).toBe("end");
    expect(nearerEnd(null, { lat: 34.2, lng: 135.1 })).toBeNull();
  });

  test("entries for the nearer end first, then either/unsaid, then the other end; ties keep their order", () => {
    const pts = [{ id: "a", serves: "start" as const }, { id: "b", serves: null }, { id: "c", serves: "end" as const }, { id: "d", serves: "both" as const }];
    expect(sortAccess(pts, "end").map((p) => p.id)).toEqual(["c", "b", "d", "a"]);
    expect(sortAccess(pts, null).map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("courseEnds", () => {
  test("the line's ends, else the first and last stop, else nothing", async () => {
    const { courseEnds } = await import("./transit-links");
    expect(courseEnds({ line: [[135, 34.2], [135.1, 34.2], [135.2, 34.3]], stops: [] })).toEqual({ start: { lng: 135, lat: 34.2 }, end: { lng: 135.2, lat: 34.3 } });
    expect(courseEnds({ line: [], stops: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }] })).toEqual({ start: { lat: 1, lng: 2 }, end: { lat: 5, lng: 6 } });
    expect(courseEnds({ line: [], stops: [{ lat: 1, lng: 2 }] })).toBeNull();
  });
});

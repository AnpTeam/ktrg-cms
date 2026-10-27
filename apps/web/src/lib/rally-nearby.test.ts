import { describe, expect, test } from "bun:test";
import { nearestToStamp, type RallyPlace } from "./rally-nearby";

const place = (id: string, lat: number | null, over: Partial<RallyPlace> = {}): RallyPlace => ({ id, routeId: "r", nameJa: id, nameEn: null, status: "open", radiusM: 40, lat, lng: lat === null ? null : 135.1, ...over });

describe("nearestToStamp", () => {
  const here = { lat: 34.2, lng: 135.1 };

  test("picks the nearest place the visitor does not hold, and says whether it is close enough to try", () => {
    const places = [place("far", 34.3), place("held", 34.2), place("close", 34.2005)];
    const got = nearestToStamp(here, places, new Set(["held"]));
    expect(got?.place.id).toBe("close");
    expect(got?.near).toBe(true); // about 55 m, radius 40 plus room for the phone's error
    expect(nearestToStamp(here, [place("far", 34.3)], new Set())?.near).toBe(false);
  });

  test("closed places and places without a checked position are never picked; nothing left is null", () => {
    const places = [place("closed", 34.2, { status: "closed" }), place("unchecked", null)];
    expect(nearestToStamp(here, places, new Set())).toBeNull();
    expect(nearestToStamp(here, [place("a", 34.2)], new Set(["a"]))).toBeNull();
  });
});

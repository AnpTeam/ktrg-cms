import { describe, expect, test } from "bun:test";
import { resumeFrom, type MapCamera } from "./map-memory";

const camera: MapCamera = { center: [135.5, 34.4], zoom: 13, pitch: 45, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
const memory = { place: { routeId: "r16", stopId: "s1", viaMounds: false, snap: "half" as const }, camera };
const arrival = { routeIds: ["r1", "r16"], wantedRouteId: null, wantedStopId: null, wantedPlaceId: null, navigating: false };

describe("resumeFrom", () => {
  test("coming back brings the course, stop, sheet and camera back", () => {
    expect(resumeFrom(memory, arrival)).toEqual({ ...memory.place, camera });
  });
  test("nothing remembered starts as usual", () => {
    expect(resumeFrom({ place: null, camera: null }, arrival)).toBeNull();
  });
  test("a link to another course, a stop or a place wins", () => {
    expect(resumeFrom(memory, { ...arrival, wantedRouteId: "r1" })).toBeNull();
    expect(resumeFrom(memory, { ...arrival, wantedRouteId: "r16", wantedStopId: "s2" })).toBeNull();
    expect(resumeFrom(memory, { ...arrival, wantedRouteId: "r16", wantedPlaceId: "p1" })).toBeNull();
  });
  test("a link to the same course keeps the view", () => {
    expect(resumeFrom(memory, { ...arrival, wantedRouteId: "r16" })).not.toBeNull();
  });
  test("a running navigation wins", () => {
    expect(resumeFrom(memory, { ...arrival, navigating: true })).toBeNull();
  });
  test("a course that is gone is not brought back", () => {
    expect(resumeFrom(memory, { ...arrival, routeIds: ["r1"] })).toBeNull();
  });
  test("a sheet put away by a navigation comes back open", () => {
    expect(resumeFrom({ place: { ...memory.place, snap: "hidden" }, camera }, arrival)?.snap).toBe("half");
    expect(resumeFrom({ place: { ...memory.place, routeId: null, snap: "hidden" }, camera }, arrival)?.snap).toBe("peek");
  });
});

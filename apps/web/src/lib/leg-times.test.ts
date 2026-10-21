import { describe, expect, test } from "bun:test";
import { legTime, timesFromPrevious } from "./leg-times";
import type { LngLatEle } from "./admin/line";

// About 1.1 km per 0.01 degree of latitude.
const flat: LngLatEle[] = [[135, 34], [135, 34.01], [135, 34.02], [135, 34.03]];

describe("legTime", () => {
  test("flat ground is 3 km/h, rounded to 5 minutes", () => {
    expect(legTime(flat.slice(0, 2))).toEqual({ km: 1.11, minutes: 20 });
  });

  test("climbing adds an hour for every 600 m", () => {
    const up: LngLatEle[] = [[135, 34, 0], [135, 34.01, 300], [135, 34.02, 600]];
    expect(legTime(up)!.minutes).toBe(Math.round(((2.22 / 3 + 1) * 60) / 5) * 5);
  });

  test("a line of no length has no time", () => {
    expect(legTime([[135, 34], [135, 34]])).toBeNull();
  });
});

describe("timesFromPrevious", () => {
  const at = (id: string, lat: number, extra: { stopBy?: boolean } = {}) => ({ id, position: { lat, lng: 135 }, ...extra });

  test("each place after the first gets the time of the line from the one before", () => {
    const times = timesFromPrevious([at("a", 34), at("b", 34.01), at("c", 34.03)], flat);
    expect([...times.keys()]).toEqual(["b", "c"]);
    expect(times.get("b")!.minutes).toBeLessThan(times.get("c")!.minutes);
  });

  test("a side trip is skipped, and places that do not follow the line get no times", () => {
    expect([...timesFromPrevious([at("a", 34), at("side", 34.015, { stopBy: true }), at("b", 34.03)], flat).keys()]).toEqual(["b"]);
    expect(timesFromPrevious([at("a", 34), at("far", 35.5)], flat).size).toBe(0);
  });
});

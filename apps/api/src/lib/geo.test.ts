import { describe, expect, test } from "bun:test";
import { distanceMeters, isWithinRadius, EARTH_RADIUS_M } from "./geo";

const osaka = { lat: 34.7025, lng: 135.4959 };
const nara = { lat: 34.6815, lng: 135.8189 };
const tokyo = { lat: 35.6812, lng: 139.7671 };

describe("distanceMeters", () => {
  test("same point is 0 m", () => {
    expect(distanceMeters(osaka, osaka)).toBe(0);
  });

  test("is symmetric", () => {
    expect(distanceMeters(osaka, nara)).toBeCloseTo(distanceMeters(nara, osaka), 6);
  });

  // References computed independently with the spherical law of cosines.
  test("Osaka Station to Nara Station is about 29.6 km", () => {
    expect(distanceMeters(osaka, nara)).toBeCloseTo(29_623, -1); // within ~5 m
  });

  test("Tokyo Station to Osaka Station is about 403 km", () => {
    expect(distanceMeters(tokyo, osaka)).toBeCloseTo(403_059, -1);
  });

  test("1 degree of latitude is about 111.2 km", () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  test("a point ~50 m north is ~50 m away (check-in scale)", () => {
    const metresPerDegree = (EARTH_RADIUS_M * Math.PI) / 180;
    const p = { lat: 34 + 50 / metresPerDegree, lng: 135 };
    expect(distanceMeters({ lat: 34, lng: 135 }, p)).toBeCloseTo(50, 3);
  });

  test("longitude degrees shrink with latitude", () => {
    const equator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const japan = distanceMeters({ lat: 35, lng: 135 }, { lat: 35, lng: 136 });
    expect(japan).toBeCloseTo(equator * Math.cos((35 * Math.PI) / 180), -1);
  });

  test("crosses the antimeridian the short way", () => {
    const d = distanceMeters({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 });
    expect(d).toBeCloseTo(111_195, -1); // 1 degree, not 359
  });

  test("antipodal points are half the circumference", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(d).toBeCloseTo(Math.PI * EARTH_RADIUS_M, 0);
  });

  test("poles work", () => {
    const d = distanceMeters({ lat: 90, lng: 0 }, { lat: -90, lng: 0 });
    expect(d).toBeCloseTo(Math.PI * EARTH_RADIUS_M, 0);
  });

  test("rejects out-of-range or non-finite coordinates", () => {
    expect(() => distanceMeters({ lat: 91, lng: 0 }, osaka)).toThrow(RangeError);
    expect(() => distanceMeters(osaka, { lat: 0, lng: 181 })).toThrow(RangeError);
    expect(() => distanceMeters({ lat: NaN, lng: 0 }, osaka)).toThrow(RangeError);
  });
});

describe("isWithinRadius", () => {
  const metresPerDegree = (EARTH_RADIUS_M * Math.PI) / 180;
  const centre = { lat: 34, lng: 135 };
  const north = (m: number) => ({ lat: 34 + m / metresPerDegree, lng: 135 });

  test("inside the radius", () => {
    expect(isWithinRadius(north(30), centre, 50)).toBe(true);
  });

  test("outside the radius", () => {
    expect(isWithinRadius(north(80), centre, 50)).toBe(false);
  });

  test("exactly on the edge counts as inside", () => {
    expect(isWithinRadius(centre, centre, 0)).toBe(true);
  });
});

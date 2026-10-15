import { describe, expect, test } from "bun:test";
import { elevationProfile, elevationStats, parseGpx, simplifyTrack, trackLengthM } from "./gpx";

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Navivi" xmlns="http://www.topografix.com/GPX/1/1">
  <time>2026-10-15T06:48:58.885Z</time>
  <wpt lat="34.255603" lon="135.110513">
    <name>西ノ庄駅 &amp; 西念寺</name>
  </wpt>
  <trk>
    <name>2</name>
    <trkseg>
      <trkpt lat="34.2556" lon="135.1105"><ele>8.3</ele><time>2026-10-15T06:48:58Z</time><speed>1.4</speed></trkpt>
      <trkpt lat="34.2566" lon="135.1105"><ele>20</ele></trkpt>
      <trkpt lat="34.2576" lon="135.1105"><ele>35.5</ele></trkpt>
      <trkpt lat="34.2586" lon="135.1105" />
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx", () => {
  const gpx = parseGpx(GPX);

  test("reads waypoints, decoding XML entities", () => {
    expect(gpx.waypoints).toEqual([{ name: "西ノ庄駅 & 西念寺", lat: 34.255603, lng: 135.110513 }]);
  });

  test("reads track points with elevation, and null when a point has none", () => {
    expect(gpx.track).toHaveLength(4);
    expect(gpx.track[0]).toEqual({ lat: 34.2556, lng: 135.1105, ele: 8.3 });
    expect(gpx.track[3]!.ele).toBeNull();
  });

  test("a bad coordinate names the point", () => {
    expect(() => parseGpx('<trkpt lat="95" lon="135"><ele>1</ele></trkpt>')).toThrow(/track point 1: bad latitude/);
    expect(() => parseGpx('<wpt lat="34" lon="x"><name>a</name></wpt>')).toThrow(/waypoint: bad longitude/);
  });

  test("an empty file gives empty lists", () => {
    expect(parseGpx("<gpx></gpx>")).toEqual({ waypoints: [], track: [] });
  });
});

describe("measures", () => {
  // 0.001 degrees of latitude is about 111 m.
  const track = [0, 1, 2, 3].map((i) => ({ lat: 34 + i * 0.001, lng: 135, ele: 10 + i * 10 }));

  test("track length is the sum of the segments", () => {
    expect(trackLengthM(track)).toBeGreaterThan(330);
    expect(trackLengthM(track)).toBeLessThan(336);
    expect(trackLengthM([])).toBe(0);
  });

  test("a steady climb counts as ascent, no descent", () => {
    const stats = elevationStats(track, 1)!;
    expect(stats.ascentM).toBe(30);
    expect(stats.descentM).toBe(0);
    expect([stats.minM, stats.maxM]).toEqual([10, 40]);
  });

  test("smoothing stops noise from counting as climbing", () => {
    const flat = Array.from({ length: 40 }, (_, i) => ({ lat: 34 + i * 0.0001, lng: 135, ele: 100 + (i % 2 ? 1 : -1) }));
    expect(elevationStats(flat, 1)!.ascentM).toBeGreaterThan(30);
    expect(elevationStats(flat, 9)!.ascentM).toBeLessThan(5);
  });

  test("no elevation data gives no stats and no profile", () => {
    const bare = [{ lat: 34, lng: 135, ele: null }, { lat: 34.001, lng: 135, ele: null }];
    expect(elevationStats(bare)).toBeNull();
    expect(elevationProfile(bare, 10)).toEqual([]);
  });

  test("the profile has the requested number of samples from start to end", () => {
    const profile = elevationProfile(track, 7);
    expect(profile).toHaveLength(7);
    expect(profile[0]).toBeLessThan(profile[6]!);
  });
});

describe("simplifyTrack", () => {
  // A zig-zag of 200 points along a gently curved line.
  const curve = Array.from({ length: 200 }, (_, i) => ({ lat: 34 + i * 0.0002, lng: 135 + Math.sin(i / 20) * 0.001, ele: 0 }));

  test("keeps at most the requested number of points, including both ends", () => {
    const out = simplifyTrack(curve, 25);
    expect(out.length).toBeLessThanOrEqual(25);
    expect(out[0]).toBe(curve[0]!);
    expect(out[out.length - 1]).toBe(curve[199]!);
  });

  test("a short track is returned unchanged", () => {
    expect(simplifyTrack(curve.slice(0, 5), 25)).toHaveLength(5);
  });

  test("the simplified line is about as long as the original", () => {
    const out = simplifyTrack(curve, 40);
    expect(trackLengthM(out) / trackLengthM(curve)).toBeGreaterThan(0.97);
  });
});

import { describe, expect, test } from "bun:test";
import { buildGpx } from "./gpx-export";

describe("buildGpx", () => {
  const line = { type: "LineString" as const, coordinates: [[135.1, 34.2, 120], [135.2, 34.3]] as [number, number, number?][] };

  test("one track with the elevation where there is one, and the places as waypoints", () => {
    const gpx = buildGpx("金剛山 & 葛城", line, [{ name: "<経塚>", lat: 34.25, lng: 135.15 }]);
    expect(gpx).toContain('<trkpt lat="34.2" lon="135.1"><ele>120</ele></trkpt>');
    expect(gpx).toContain('<trkpt lat="34.3" lon="135.2"></trkpt>');
    expect(gpx).toContain('<wpt lat="34.25" lon="135.15"><name>&lt;経塚&gt;</name></wpt>');
    expect(gpx).toContain("<name>金剛山 &amp; 葛城</name>");
    expect(gpx).not.toContain("<time>"); // a drawn line is not a walk
  });

  test("a route with no places has no waypoints", () => {
    expect(buildGpx("x", line, [])).not.toContain("<wpt");
  });
});

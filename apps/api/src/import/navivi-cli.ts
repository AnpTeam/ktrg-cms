// Prints a route's Navivi export as JSON, for checking and for building sample content.
//   bun run apps/api/src/import/navivi-cli.ts <folder> <route number>
// The folder holds `<n>_stops.csv` and `<n>_legs.csv`, and optionally `raw_track.gpx` (the path and
// its elevation). Read-only: nothing is written.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { elevationProfile, elevationStats, parseGpx, simplifyTrack, trackLengthM } from "./gpx";
import { parseLegs, parseStops, stopsSketch, totalDistanceKm } from "./navivi";

const [folder, order] = process.argv.slice(2);
if (!folder || !order) {
  console.error("usage: navivi-cli <folder> <route number>");
  process.exit(1);
}

const stops = parseStops(readFileSync(join(folder, `${order}_stops.csv`), "utf8"));
const legs = parseLegs(readFileSync(join(folder, `${order}_legs.csv`), "utf8"));

// The path and elevation, when the export has them. Simplified to at most 250 points.
const gpxFile = join(folder, "raw_track.gpx");
const gpx = existsSync(gpxFile) ? parseGpx(readFileSync(gpxFile, "utf8")) : null;
const track = gpx && gpx.track.length > 1
  ? {
      lengthKm: Math.round(trackLengthM(gpx.track) / 100) / 10,
      points: simplifyTrack(gpx.track, 250).map((pt) => [Number(pt.lat.toFixed(6)), Number(pt.lng.toFixed(6))]),
      elevation: elevationStats(gpx.track),
      profile: elevationProfile(gpx.track, 60),
    }
  : null;

console.log(
  JSON.stringify(
    {
      order: Number(order),
      distanceKm: totalDistanceKm(legs),
      stopCount: stops.length,
      sketch: stopsSketch(stops),
      stops,
      track,
    },
    null,
    2,
  ),
);

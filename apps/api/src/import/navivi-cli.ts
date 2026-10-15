// Prints a route's Navivi export as JSON, for checking and for building sample content.
//   bun run apps/api/src/import/navivi-cli.ts <folder> <route number>
// The folder holds `<n>_stops.csv` and `<n>_legs.csv`. Read-only: nothing is written.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLegs, parseStops, stopsSketch, totalDistanceKm } from "./navivi";

const [folder, order] = process.argv.slice(2);
if (!folder || !order) {
  console.error("usage: navivi-cli <folder> <route number>");
  process.exit(1);
}

const stops = parseStops(readFileSync(join(folder, `${order}_stops.csv`), "utf8"));
const legs = parseLegs(readFileSync(join(folder, `${order}_legs.csv`), "utf8"));

console.log(
  JSON.stringify(
    {
      order: Number(order),
      distanceKm: totalDistanceKm(legs),
      stopCount: stops.length,
      sketch: stopsSketch(stops),
      stops,
    },
    null,
    2,
  ),
);

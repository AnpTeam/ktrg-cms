import { expect, test } from "bun:test";
import { attention } from "./attention";

const spot = (over: Record<string, unknown> = {}) => ({ id: "s", nameJa: "経塚", nameEn: "Mound", photoUrl: "https://x/a.jpg", photos: [], positionVerified: true, lat: 34, published: true, ...over });
const route = (over: Record<string, unknown> = {}) => ({ id: "r", nameJa: "道", nameEn: "Road", geometry: { type: "LineString" as const, coordinates: [] }, lineVerified: true, photoUrl: "https://x/r.jpg", spots: [spot()], ...over });

test("a route and a waypoint with nothing missing are not listed", () => {
  expect(attention([route() as never])).toEqual({ routes: [], spots: [] });
});

test("each missing thing is named, for the route and for its waypoints", () => {
  const found = attention([
    route({ geometry: null, nameEn: " ", photoUrl: null, spots: [spot({ photoUrl: null, nameEn: null, positionVerified: false })] }) as never,
    route({ id: "r2", lineVerified: false, spots: [spot({ photoUrl: null, photos: [{ url: "https://x/g.jpg" }] })] }) as never,
  ]);
  expect(found.routes).toEqual([
    { id: "r", nameJa: "道", issues: ["no_line", "no_english_name", "no_photo"] },
    { id: "r2", nameJa: "道", issues: ["line_unchecked"] },
  ]);
  expect(found.spots).toEqual([{ id: "s", routeId: "r", routeNameJa: "道", nameJa: "経塚", published: true, issues: ["no_photo", "no_english_name", "position_unchecked"] }]);
});

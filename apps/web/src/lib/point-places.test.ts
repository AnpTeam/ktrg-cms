import { describe, expect, test } from "bun:test";
import type { RoutePoint } from "./content";
import { pointsAsPlaces } from "./point-places";

const point = (over: Partial<RoutePoint>): RoutePoint => ({
  id: "p1",
  kind: "toilet",
  nameJa: "トイレ",
  nameEn: "Toilet",
  descriptionJa: null,
  descriptionEn: null,
  position: { lat: 34.5, lng: 135.6, verified: true },
  ...over,
});

describe("pointsAsPlaces", () => {
  test("a toilet becomes a toilet place in the visitor's language", () => {
    const [p] = pointsAsPlaces([point({})], "en");
    expect(p).toMatchObject({ id: "p1", category: "toilet", name: "Toilet", nameLang: "en", status: "open", verified: true });
    expect(pointsAsPlaces([point({})], "ja")[0]!.name).toBe("トイレ");
  });

  test("turns, danger and view points land in the 'other' category", () => {
    expect(pointsAsPlaces([point({ kind: "turn" }), point({ id: "p2", kind: "danger" })], "ja").map((p) => p.category)).toEqual(["other", "other"]);
  });

  test("a point with no position cannot be drawn and is left out", () => {
    expect(pointsAsPlaces([point({ position: null })], "ja")).toEqual([]);
  });

  test("an unchecked position stays marked as a draft", () => {
    expect(pointsAsPlaces([point({ position: { lat: 1, lng: 2, verified: false } })], "ja")[0]!.verified).toBe(false);
  });
});

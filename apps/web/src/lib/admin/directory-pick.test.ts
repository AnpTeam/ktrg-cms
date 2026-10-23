import { describe, expect, test } from "bun:test";
import { kindOfCategory, pickList, type DirectoryPlace } from "./directory-pick";

const p = (id: string, category: string, nameJa: string, lat: number, lng = 135): DirectoryPlace => ({ id, category, nameJa, nameEn: null, lat, lng, address: null });
const places = [p("far", "parking", "遠い駐車場", 34.5), p("near", "parking", "加太港駐車場", 34.27), p("wc", "toilet", "公衆トイレ", 34.271), p("shop", "cafe", "喫茶", 34.272)];

describe("pickList", () => {
  test("nearest first from a point, filtered by category", () => {
    const rows = pickList(places, { from: { lat: 34.27, lng: 135 }, category: "parking", query: "" });
    expect(rows.map((r) => r.id)).toEqual(["near", "far"]);
    expect(rows[0]!.meters).toBeLessThan(5);
  });
  test("words match the name, ignoring case and width; without a point the order is by name and there is no distance", () => {
    expect(pickList(places, { from: null, category: "", query: "トイレ" }).map((r) => r.id)).toEqual(["wc"]);
    const all = pickList(places, { from: null, category: "", query: "" });
    expect(all).toHaveLength(4);
    expect(all.every((r) => r.meters === null)).toBe(true);
  });
  test("the list is cut at the limit", () => {
    expect(pickList(places, { from: null, category: "", query: "", limit: 2 })).toHaveLength(2);
  });
});

test("a directory category becomes the waypoint kind of the same name; shops and cafes are other", () => {
  expect(kindOfCategory("parking")).toBe("parking");
  expect(kindOfCategory("cafe")).toBe("other");
  expect(kindOfCategory("souvenir_shop")).toBe("other");
});

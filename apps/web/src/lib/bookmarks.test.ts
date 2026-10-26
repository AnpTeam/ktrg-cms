import { expect, test } from "bun:test";
import { parseBookmarks, toggleBookmark } from "./bookmarks";

const a = { id: "a", nameJa: "あ", nameEn: null };
const b = { id: "b", nameJa: "い", nameEn: "B" };

test("toggle adds to the front and removes", () => {
  expect(toggleBookmark([a], b).map((x) => x.id)).toEqual(["b", "a"]);
  expect(toggleBookmark([b, a], b).map((x) => x.id)).toEqual(["a"]);
});

test("parse survives damaged storage", () => {
  expect(parseBookmarks(null)).toEqual([]);
  expect(parseBookmarks("{")).toEqual([]);
  expect(parseBookmarks('{"id":"a"}')).toEqual([]);
  expect(parseBookmarks(JSON.stringify([a, { id: 3 }, null, b]))).toEqual([a, b]);
});

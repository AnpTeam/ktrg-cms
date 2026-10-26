import { expect, test } from "bun:test";
import { mergeBookmarks, parseBookmarks, toggleBookmark } from "./bookmarks";

test("toggle adds to the front and removes", () => {
  expect(toggleBookmark(["a"], "b")).toEqual(["b", "a"]);
  expect(toggleBookmark(["b", "a"], "b")).toEqual(["a"]);
});

test("parse survives damaged storage and reads the older object form", () => {
  expect(parseBookmarks(null)).toEqual([]);
  expect(parseBookmarks("{")).toEqual([]);
  expect(parseBookmarks('{"id":"a"}')).toEqual([]);
  expect(parseBookmarks(JSON.stringify(["a", { id: "b", nameJa: "い" }, { id: 3 }, null]))).toEqual(["a", "b"]);
});

test("merge keeps each route once, the device's first", () => {
  expect(mergeBookmarks(["a", "b"], ["c", "a"])).toEqual(["c", "a", "b"]);
});

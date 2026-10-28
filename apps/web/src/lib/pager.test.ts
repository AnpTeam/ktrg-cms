import { describe, expect, test } from "bun:test";
import { clampPage, pageCount, pageSlice } from "./pager";

describe("pager", () => {
  test("counts pages, with one page even when empty", () => {
    expect([pageCount(0, 5), pageCount(5, 5), pageCount(6, 5), pageCount(53, 50)]).toEqual([1, 1, 2, 2]);
  });
  test("a typed page stays within the pages; anything else is ignored", () => {
    expect(clampPage("3", 12)).toBe(3);
    expect(clampPage("99", 12)).toBe(12);
    expect(clampPage("0", 12)).toBe(1);
    expect(clampPage("-4", 12)).toBe(1);
    expect(clampPage("2.7", 12)).toBe(2);
    expect(clampPage("", 12)).toBeNull();
    expect(clampPage("abc", 12)).toBeNull();
  });
  test("slices the rows of one page", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7];
    expect(pageSlice(rows, 1, 3)).toEqual([1, 2, 3]);
    expect(pageSlice(rows, 3, 3)).toEqual([7]);
  });
});

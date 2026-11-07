import { expect, test } from "bun:test";
import { nextNote } from "./rich-text-edit";

test("a new footnote is numbered after the ones in the text", () => {
  expect(nextNote("a[^1] b[^3]")).toBe(4);
  expect(nextNote("plain")).toBe(1);
});

import { expect, test } from "bun:test";
import { MOUND_PLACES, TOTAL_MOUNDS, TOTAL_STAMPS } from "./rally";

test("the mounds and their doubled places add up to the stamp total", () => {
  expect(MOUND_PLACES).toHaveLength(TOTAL_MOUNDS);
  expect(MOUND_PLACES.reduce((a, b) => a + b, 0)).toBe(TOTAL_STAMPS);
  expect([MOUND_PLACES[2], MOUND_PLACES[13], MOUND_PLACES[27]]).toEqual([2, 2, 2]);
});

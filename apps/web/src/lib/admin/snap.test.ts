import { describe, expect, test } from "bun:test";
import { roundLine } from "./snap";

describe("roundLine", () => {
  test("positions to 6 decimals, heights to one, a missing height stays missing", () => {
    expect(roundLine([[135.123456789, 34.987654321, 100.449], [135.2, 34.3]])).toEqual([[135.123457, 34.987654, 100.4], [135.2, 34.3]]);
  });
});

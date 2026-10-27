import { describe, expect, test } from "bun:test";
import { endOfJstDay } from "./UserActions";

describe("restriction end", () => {
  test("a chosen day lasts to the end of that day in Japan", () => {
    expect(endOfJstDay("2026-10-27")).toBe("2026-10-27T14:59:59.000Z");
  });
});

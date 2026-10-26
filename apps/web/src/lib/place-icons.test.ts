import { describe, expect, test } from "bun:test";
import { placeIconSvg } from "./place-icons";
import { placeCategories } from "./places";

describe("place pictures", () => {
  test("every kind of place has a picture, and nothing in them can run as script", () => {
    for (const category of placeCategories) {
      const svg = placeIconSvg[category];
      expect(svg.length).toBeGreaterThan(20);
      expect(svg).not.toMatch(/<script|on\w+=|javascript:/i);
    }
  });
});

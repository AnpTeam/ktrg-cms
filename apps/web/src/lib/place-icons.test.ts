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

test("a place wears its chosen picture, else its category's; an unknown name falls back", async () => {
  const { placeIconKeys, placePicture, placeIconSvg } = await import("./place-icons");
  const { pointIconSvg } = await import("./point-icons");
  expect(placePicture("cafe")).toBe(placeIconSvg.cafe);
  expect(placePicture("cafe", "restaurant")).toBe(placeIconSvg.restaurant);
  expect(placePicture("cafe", "temple")).toBe(pointIconSvg.temple);
  expect(placePicture("cafe", "dragon")).toBe(placeIconSvg.cafe);
  expect(new Set(placeIconKeys).size).toBe(placeIconKeys.length);
});

import { describe, expect, test } from "bun:test";
import { publicIdFor } from "./public-id";

describe("publicIdFor", () => {
  test("is always 8 digits", () => {
    for (const n of [1, 2, 3, 1000, 99999988]) expect(publicIdFor(n)).toMatch(/^\d{8}$/);
  });

  test("known values (the same arithmetic as the database default)", () => {
    expect(publicIdFor(1)).toBe("00048271");
    expect(publicIdFor(2)).toBe("00096542");
    expect(publicIdFor(3)).toBe("00144813");
  });

  test("never repeats over a large run of accounts, and neighbours do not look alike", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 200000; n++) seen.add(publicIdFor(n));
    expect(seen.size).toBe(200000);
    expect(publicIdFor(1)).not.toBe(publicIdFor(2));
  });
});

import { describe, expect, test } from "bun:test";
import { isEarned, medalCapacity, medalLayout } from "./medals";

describe("medalLayout", () => {
  test("everything is shown when it fits", () => {
    expect(medalLayout(8, 8)).toEqual({ shown: 8, more: 0 });
    expect(medalLayout(3, 10)).toEqual({ shown: 3, more: 0 });
  });

  test("when it does not fit, the last two spaces become the +n", () => {
    expect(medalLayout(12, 8)).toEqual({ shown: 6, more: 6 });
    expect(medalLayout(9, 8)).toEqual({ shown: 6, more: 3 });
  });

  test("no stamps: nothing; a very narrow line still shows one medal", () => {
    expect(medalLayout(0, 8)).toEqual({ shown: 0, more: 0 });
    expect(medalLayout(5, 1)).toEqual({ shown: 1, more: 4 });
    expect(medalLayout(5, 0)).toEqual({ shown: 1, more: 4 });
  });
});

describe("medalCapacity", () => {
  test("how many medals of 28 px with 6 px gaps fit across a width", () => {
    expect(medalCapacity(34 * 8 - 6, 28, 6)).toBe(8);
    expect(medalCapacity(100, 28, 6)).toBe(3);
  });
  test("an unmeasured or tiny width still allows one", () => {
    expect(medalCapacity(0, 28, 6)).toBe(1);
    expect(medalCapacity(10, 28, 6)).toBe(1);
  });
});

describe("isEarned", () => {
  test("the first n are earned; signed out (null) none are", () => {
    expect([0, 1, 2, 3].map((i) => isEarned(i, 2))).toEqual([true, true, false, false]);
    expect(isEarned(0, null)).toBe(false);
  });
});

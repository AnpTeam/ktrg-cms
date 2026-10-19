import { describe, expect, test } from "bun:test";
import { clusterByPixels } from "./cluster";

const p = (id: string, x: number, y: number) => ({ id, x, y });

describe("clusterByPixels", () => {
  test("points far apart stay on their own", () => {
    expect(clusterByPixels([p("a", 0, 0), p("b", 100, 0), p("c", 0, 100)], 40)).toEqual([["a"], ["b"], ["c"]]);
  });

  test("points closer than the distance join", () => {
    expect(clusterByPixels([p("a", 0, 0), p("b", 10, 10), p("c", 200, 200)], 40)).toEqual([["a", "b"], ["c"]]);
  });

  test("exactly the distance apart is not joined", () => {
    expect(clusterByPixels([p("a", 0, 0), p("b", 40, 0)], 40)).toEqual([["a"], ["b"]]);
  });

  test("a chain does not collapse into one group: the same zoom always gives the same groups", () => {
    // a-b close, b-c close, a-c far: c is measured against the first member only.
    expect(clusterByPixels([p("a", 0, 0), p("b", 30, 0), p("c", 60, 0)], 40)).toEqual([["a", "b"], ["c"]]);
  });

  test("order is kept and empty input is fine", () => {
    expect(clusterByPixels([], 40)).toEqual([]);
    expect(clusterByPixels([p("z", 0, 0), p("a", 500, 0)], 40)).toEqual([["z"], ["a"]]);
  });

  test("identical positions always join", () => {
    expect(clusterByPixels([p("a", 5, 5), p("b", 5, 5), p("c", 5, 5)], 1)).toEqual([["a", "b", "c"]]);
  });
});

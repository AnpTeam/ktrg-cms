import { describe, expect, test } from "bun:test";
import { EDGE_PX, initialBars, nextBars, SLACK_PX } from "./scroll-bars";

const walk = (ys: number[], maxY = 5000) => ys.reduce((s, y) => nextBars(s, y, maxY), initialBars());

describe("bars that step aside while scrolling", () => {
  test("scrolling down past the slack hides them; scrolling back up past it shows them", () => {
    expect(walk([200, 200 + SLACK_PX]).hidden).toBe(true);
    expect(walk([200, 200 + SLACK_PX, 300, 300 - SLACK_PX]).hidden).toBe(false);
  });

  test("a small jitter changes nothing", () => {
    expect(walk([200, 260, 255, 262]).hidden).toBe(true);
    expect(walk([200, 260, 200, 210, 205]).hidden).toBe(false);
  });

  test("near the top and the bottom of the page they always show", () => {
    expect(walk([EDGE_PX - 1]).hidden).toBe(false);
    expect(walk([200, 400, 4990], 5000).hidden).toBe(false);
  });
});

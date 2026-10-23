import { expect, test } from "bun:test";
import { pointIconSvg } from "./point-icons";
import { pointKinds } from "./point-kinds";

test("every kind of waypoint has a picture", () => {
  for (const kind of pointKinds) expect(pointIconSvg[kind].length).toBeGreaterThan(20);
});

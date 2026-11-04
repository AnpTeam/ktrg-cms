import { expect, test } from "bun:test";
import { getElevationCursor, setElevationCursor } from "./elevation-cursor";

test("the cursor is set, replaced and cleared", () => {
  expect(getElevationCursor()).toBeNull();
  setElevationCursor({ lat: 34.5, lng: 135 });
  expect(getElevationCursor()).toEqual({ lat: 34.5, lng: 135 });
  setElevationCursor(null);
  expect(getElevationCursor()).toBeNull();
});

import { expect, test } from "bun:test";
import { liveStatus, parseStatuses } from "./status-client";

test("the statuses are read, and what is not one is left out", () => {
  const got = parseStatuses({ ok: true, spots: [{ id: "a", status: "closed" }, { id: "b", status: "gone" }, { status: "open" }, null] });
  expect([...got!]).toEqual([["a", "closed"]]);
  expect(parseStatuses({ ok: false })).toBeNull();
  expect(parseStatuses(null)).toBeNull();
});

test("a status read later wins, but not one for another place or from before the page changed", () => {
  const read = { spotId: "a", shown: "open" as const, status: "closed" as const };
  expect(liveStatus(read, "a", "open")).toBe("closed");
  expect(liveStatus(read, "b", "open")).toBe("open");
  expect(liveStatus(read, "a", "caution")).toBe("caution");
  expect(liveStatus(null, "a", "open")).toBe("open");
});

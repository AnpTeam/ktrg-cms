import { expect, test } from "bun:test";
import { parseStatuses } from "./status-client";

test("the statuses are read, and what is not one is left out", () => {
  const got = parseStatuses({ ok: true, spots: [{ id: "a", status: "closed" }, { id: "b", status: "gone" }, { status: "open" }, null] });
  expect([...got!]).toEqual([["a", "closed"]]);
  expect(parseStatuses({ ok: false })).toBeNull();
  expect(parseStatuses(null)).toBeNull();
});

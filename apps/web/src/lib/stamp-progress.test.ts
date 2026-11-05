import { expect, test } from "bun:test";

import { progressFromAccepted } from "./stamp-progress";

const row = (rallyName: string, before: number, place: string) => ({ celebrate: { rallyName, before, total: 10, place } });
test("waiting stamps that were taken give one popup per rally, counting them all", () => {
  const got = progressFromAccepted([
    { kind: "accepted", already: false, row: row("A", 3, "一") },
    { kind: "accepted", already: false, row: row("A", 4, "二") },
    { kind: "accepted", already: false, row: row("B", 0, "三") },
  ]);
  expect(got).toEqual([
    { rallyName: "A", before: 3, after: 5, total: 10, place: "二" },
    { rallyName: "B", before: 0, after: 1, total: 10, place: "三" },
  ]);
});

test("a stamp the server already had, a refused one, or one with no rally known gives no popup", () => {
  expect(progressFromAccepted([{ kind: "accepted", already: true, row: row("A", 1, "一") }, { kind: "rejected", row: row("A", 1, "二") }, { kind: "accepted", already: false, row: {} }])).toEqual([]);
});

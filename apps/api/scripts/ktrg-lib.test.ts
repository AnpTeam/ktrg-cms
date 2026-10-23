import { expect, test } from "bun:test";
import { newFiles, parseJournal, pendingMigrations } from "./ktrg-lib";

const journal = JSON.stringify({ entries: [{ idx: 0, version: "7", when: 100, tag: "0000_init" }, { idx: 1, version: "7", when: 200, tag: "0001_a" }, { idx: 2, version: "7", when: 300, tag: "0002_b" }] });

test("a migration is waiting when it is newer than the newest applied one", () => {
  const entries = parseJournal(journal);
  expect(entries.map((e) => e.tag)).toEqual(["0000_init", "0001_a", "0002_b"]);
  expect(pendingMigrations(entries, [100, 200, 300])).toEqual([]);
  expect(pendingMigrations(entries, [100, 200]).map((e) => e.tag)).toEqual(["0002_b"]);
  expect(pendingMigrations(entries, []).map((e) => e.tag)).toEqual(["0000_init", "0001_a", "0002_b"]);
});

test("newFiles lists what appeared", () => {
  expect(newFiles(new Set(["a.sql", "meta/_journal.json"]), new Set(["a.sql", "meta/_journal.json", "b.sql", "meta/b.json"]))).toEqual(["b.sql", "meta/b.json"]);
  expect(newFiles(new Set(["a"]), new Set(["a"]))).toEqual([]);
});

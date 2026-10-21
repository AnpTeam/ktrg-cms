import { describe, expect, test } from "bun:test";
import { backupKey, parseBackup, worthRestoring, writeBackup } from "./draft-backup";
import { emptyDraft } from "./route-draft";

const memory = () => {
  const m = new Map<string, string>();
  return { m, store: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
};
const saved = { ...emptyDraft(), id: "r1", updatedAt: "2026-10-21T00:00:00.000Z", nameJa: "葛城の道" };

describe("the unsaved-work backup", () => {
  test("a copy is kept while there are unsaved changes and dropped once everything is saved", () => {
    const { m, store } = memory();
    const edited = { ...saved, nameJa: "変えた" };
    writeBackup(store, edited, saved.updatedAt, true);
    const kept = parseBackup(m.get(backupKey("r1")) ?? null);
    expect(kept?.draft.nameJa).toBe("変えた");
    expect(worthRestoring(kept, saved)).toBe(true);
    writeBackup(store, saved, saved.updatedAt, false);
    expect(m.size).toBe(0);
  });

  test("a copy of another version, an identical one, or junk is not offered", () => {
    const { store, m } = memory();
    writeBackup(store, { ...saved, nameJa: "x" }, "2026-01-01T00:00:00.000Z", true);
    expect(worthRestoring(parseBackup(m.get(backupKey("r1")) ?? null), saved)).toBe(false); // the route moved on since
    writeBackup(store, saved, saved.updatedAt, true);
    expect(worthRestoring(parseBackup(m.get(backupKey("r1")) ?? null), saved)).toBe(false); // nothing differs
    expect(parseBackup("{not json")).toBeNull();
    expect(parseBackup('{"at":"x","base":null,"draft":{}}')).toBeNull();
    expect(parseBackup(null)).toBeNull();
  });

  test("full or blocked storage does not break editing", () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => writeBackup(broken, saved, saved.updatedAt, true)).not.toThrow();
    expect(() => writeBackup(broken, saved, saved.updatedAt, false)).not.toThrow();
  });
});

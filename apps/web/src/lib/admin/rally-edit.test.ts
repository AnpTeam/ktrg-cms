import { describe, expect, test } from "bun:test";
import { groupBy, nameChanges, sameOrder, tickAll, toggleMember } from "./rally-edit";

describe("ticking members", () => {
  test("a ticked one goes to the end; ticking again removes it", () => {
    expect(toggleMember(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleMember(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  test("tick all keeps the ticked ones first, then the rest in their order; untick all empties", () => {
    expect(tickAll(["c"], ["a", "b", "c", "d"], true)).toEqual(["c", "a", "b", "d"]);
    expect(tickAll(["c"], ["a", "b"], false)).toEqual([]);
  });

  test("order comparison", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});

describe("grouping places by course", () => {
  test("keeps the order the groups first appear in", () => {
    const places = [{ id: 1, r: "x" }, { id: 2, r: "y" }, { id: 3, r: "x" }];
    expect(groupBy(places, (p) => p.r)).toEqual([
      { key: "x", items: [{ id: 1, r: "x" }, { id: 3, r: "x" }] },
      { key: "y", items: [{ id: 2, r: "y" }] },
    ]);
  });
});

describe("what names changed", () => {
  test("nothing changed: nothing to send", () => {
    expect(nameChanges({ nameJa: "経塚", nameEn: null }, { nameJa: "経塚", nameEn: "" })).toEqual({});
  });

  test("trimmed, and an empty English name clears it", () => {
    expect(nameChanges({ nameJa: "経塚", nameEn: "Mounds" }, { nameJa: " 新しい ", nameEn: "  " })).toEqual({ nameJa: "新しい", nameEn: null });
  });
});

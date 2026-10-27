import { describe, expect, test } from "bun:test";
import { choiceFromItem } from "./relation-lookup";

const names = new Map([["r1", "金剛山コース"]]);

describe("choiceFromItem", () => {
  test("names the row in the page's language and adds the route it is on", () => {
    const item = { id: "p1", nameJa: "公衆トイレ", nameEn: "Public toilet", routeId: "r1", createdAt: "", updatedAt: "" };
    expect(choiceFromItem("name", item, "ja", names)).toEqual({ id: "p1", name: "公衆トイレ", detail: "金剛山コース" });
    expect(choiceFromItem("name", item, "en", names).name).toBe("Public toilet");
  });

  test("a row with no route, or a route that is not known, has no second line", () => {
    expect(choiceFromItem("name", { id: "p2", nameJa: "駅", nameEn: null, createdAt: "", updatedAt: "" }, "ja", names)).toEqual({ id: "p2", name: "駅" });
    expect(choiceFromItem("name", { id: "p3", nameJa: "駅", nameEn: null, routeId: "gone", createdAt: "", updatedAt: "" }, "ja", names)).toEqual({ id: "p3", name: "駅" });
    expect(choiceFromItem("name", { id: "p4", nameJa: "駅", nameEn: null, routeId: "r1", createdAt: "", updatedAt: "" }, "ja", null)).toEqual({ id: "p4", name: "駅" });
  });
});

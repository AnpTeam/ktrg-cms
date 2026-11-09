import { describe, expect, test } from "bun:test";
import { directoryList, type PlaceCategory, type PlaceStatus } from "./places";

const p = (nameJa: string, category: PlaceCategory, routes: number[], status: PlaceStatus = "open") => ({ nameJa, category, routes, status });

describe("directoryList", () => {
  const all = [p("茶屋", "cafe", [2]), p("駅", "station", [3]), p("売店", "souvenir_shop", [3]), p("旧店", "restaurant", [3], "gone"), p("便所", "toilet", [])];

  test("leaves out a place that is gone and sorts by name", () => {
    expect(directoryList(all, {}).map((x) => x.nameJa)).toEqual([...["茶屋", "駅", "売店", "便所"]].sort((a, b) => a.localeCompare(b, "ja")));
  });

  test("keeps one group, one course, or both", () => {
    expect(directoryList(all, { group: "shops" }).map((x) => x.nameJa).sort()).toEqual(["売店", "茶屋"].sort());
    expect(directoryList(all, { route: 3 }).map((x) => x.nameJa).sort()).toEqual(["売店", "駅"].sort());
    expect(directoryList(all, { group: "shops", route: 3 }).map((x) => x.nameJa)).toEqual(["売店"]);
  });
});

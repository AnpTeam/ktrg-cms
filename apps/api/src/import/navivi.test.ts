import { describe, expect, test } from "bun:test";
import { parseCsv, parseLegs, parseStops, stopsSketch, totalDistanceKm } from "./navivi";

const BOM = "﻿";

describe("parseCsv", () => {
  test("handles a BOM, quoted commas, doubled quotes and newlines inside quotes", () => {
    const rows = parseCsv(`${BOM}a,b\r\n"x, y","say ""hi""\nthere"\r\n`);
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere']]);
  });

  test("keeps empty fields and skips blank lines", () => {
    expect(parseCsv("a,b,c\n1,,3\n\n")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });

  test("the last row needs no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

const STOPS = `${BOM}index,label,name,lat,lng,is_stop_by,route_mode,arriving_narration,attraction_narration,photo_count,video_count,via_point_count
1,S,西ノ庄駅,34.255603,135.110513,false,draw,,ここがスタートです。,2,0,0
2,+1,慈眼院,34.279035,135.113826,true,draw,"道なりに進みます。","苔むした地面が広がります。
木々に囲まれています。",2,0,0
3,E,孝子駅,34.290876,135.150681,false,,到着です。,終点です。,2,0,0
`;

describe("parseStops", () => {
  test("reads names, coordinates, the stop-by flag and multi-line narration", () => {
    const stops = parseStops(STOPS);
    expect(stops.map((s) => s.nameJa)).toEqual(["西ノ庄駅", "慈眼院", "孝子駅"]);
    expect(stops[0]).toMatchObject({ index: 1, label: "S", lat: 34.255603, lng: 135.110513, isStopBy: false });
    expect(stops[1]).toMatchObject({ label: "+1", isStopBy: true });
    expect(stops[1]!.attractionNarration).toBe("苔むした地面が広がります。\n木々に囲まれています。");
    expect(stops[2]!.routeMode).toBe("");
  });

  test("a bad number or an impossible coordinate names the row", () => {
    expect(() => parseStops("index,label,name,lat,lng\n1,S,駅,abc,135")).toThrow(/row 2: lat/);
    expect(() => parseStops("index,label,name,lat,lng\n1,S,駅,95,135")).toThrow(/out of range/);
    expect(() => parseStops("index,label,name,lat,lng\n1,S,,34,135")).toThrow(/no name/);
  });
});

describe("legs and sketch", () => {
  const legs = parseLegs(`${BOM}from_label,to_label,from_name,to_name,mode,distance_m,distance_basis,via_point_count,point_count
S,1,西ノ庄駅,西念寺,draw,381.7,route,0,41
1,2,西念寺,葛城第二経塚,draw,2357,route,0,266
`);

  test("sums leg distances into kilometres with one decimal", () => {
    expect(legs).toHaveLength(2);
    expect(totalDistanceKm(legs)).toBe(2.7);
    expect(totalDistanceKm([])).toBe(0);
  });

  test("the sketch fits a 0..1 box with north at the top", () => {
    const sketch = stopsSketch(parseStops(STOPS));
    for (const [x, y] of sketch) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    // The last stop is north-east of the first: further right and higher up (smaller y).
    expect(sketch[2]![0]).toBeGreaterThan(sketch[0]![0]);
    expect(sketch[2]![1]).toBeLessThan(sketch[0]![1]);
    expect(stopsSketch([])).toEqual([]);
  });
});

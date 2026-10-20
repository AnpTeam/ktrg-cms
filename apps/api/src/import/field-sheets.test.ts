import { describe, expect, test } from "bun:test";
import { kindOfStop, parseFacilities, parseMoundPoints, parseStops, planLoad, type Existing } from "./field-sheets";

const STOPS = `RouteNumber,Type,Route Name,#,PlaceType,Latitude,Longtitude,Access,Distance,Time,Travel by,Detail
1,メイン,友ヶ島と加太周辺,,,,,,,,,
,Main,Tomogashima,,,,,,,,,
1.1,始,加太駅,S,駅,34.1,135.1,,－,－,－,
,Start,Kada Station,,Train Sta.,,,,,,,
1.2,スポット,行者堂,1,行,34.2,135.2,,1,1,徒歩,
,Point,Gyoja-do,,Ascetic,,,,,,Walking,
,注意,【ご注意】,!,,,,,,,,
,Caution,Caution,,,,,,,,,"a note
over two lines"
1.3,任意,第1経塚「序品」,+1,経塚,34.3,135.3,,-,,,
,Added,1st Mound,,sutra mound,,,,,,,
1.4,復帰,加太駅,E,駅,34.1,135.1,,1,1,徒歩,
,Return,Kada Station,,Train Sta.,,,,,,Walking,
2,メイン,甲山,,,,,,,,,
,Main,Kabuto,,,,,,,,,
2.1,スポット,峠,1,,34.5,135.5,,,,,
,Point,Pass,,,,,,,,,
2.2,スポット,広場,2,,34.5,135.5,,,,,
,Point,Square,,,,,,,,,`;

const PLACES = `sample,place_id,category,name_ja,name_en,ｚ,,near_spot_ja,coord_source,lat,lng
見本,場所ID,種類,名前,名前,コース番号,Index,近い,出どころ,緯度,経度
,1,トイレ,公衆トイレ,Public toilet,1,1,行者堂,地図アプリで確認,34.21,135.21
,2,飲食店,食堂,Cafe,1,1,行者堂,地図アプリで確認,34.22,135.22
,3,自動販売機,自販機,Vending,1,S,加太駅,地図アプリで確認,34.11,135.11
,4,,,,,,,,,`;

const mound = (over: Partial<Existing> = {}): Existing => ({ id: "m1", route: 1, nameJa: "友ヶ島・序品", kind: "mound", lat: null, lng: null, sortOrder: 1, ...over });

describe("parseStops", () => {
  const { routes, stops, skippedNotes } = parseStops(STOPS);
  test("reads course headings, stops with their English names, and skips notes", () => {
    expect(routes.map((r) => [r.route, r.nameJa, r.nameEn])).toEqual([[1, "友ヶ島と加太周辺", "Tomogashima"], [2, "甲山", "Kabuto"]]);
    expect(stops.map((s) => [s.route, s.code, s.type, s.nameEn])).toEqual([
      [1, "1.1", "start", "Kada Station"],
      [1, "1.2", "stamp", "Gyoja-do"],
      [1, "1.3", "optional", "1st Mound"],
      [1, "1.4", "return", "Kada Station"],
      [2, "2.1", "stamp", "Pass"],
      [2, "2.2", "stamp", "Square"],
    ]);
    expect(skippedNotes).toBe(1);
  });
  test("kinds follow the name and the place type", () => {
    expect(kindOfStop({ nameJa: "第1経塚「序品」", placeType: "経塚" })).toBe("mound");
    expect(kindOfStop({ nameJa: "x", placeType: "行（国）" })).toBe("temple");
    expect(kindOfStop({ nameJa: "x", placeType: "展望台" })).toBe("view");
    expect(kindOfStop({ nameJa: "x", placeType: "" })).toBe("other");
  });
});

describe("planLoad", () => {
  const stops = parseStops(STOPS).stops;
  const facilities = parseFacilities(PLACES);

  test("keeps the seeded mound, drops the return row and a position copied to two places, puts places after their stop", () => {
    const plan = planLoad({ stops, facilities, mounds: [], existing: [mound()] });
    expect(plan.spots.filter((s) => s.route === 1).map((s) => s.nameJa)).toEqual(["加太駅", "自販機", "行者堂", "公衆トイレ", "友ヶ島・序品"]);
    const m = plan.spots.find((s) => s.kind === "mound")!;
    expect(m.existing?.id).toBe("m1");
    expect(m.stampable).toBe(true);
    // 2.1 and 2.2 share one position: neither gets it.
    expect(plan.spots.filter((s) => s.route === 2).map((s) => s.lat)).toEqual([null, null]);
    expect(plan.waiting).toEqual({ 飲食店: 1 });
    // Only the sheet's スポット rows (and the mound) can be stamped; places along the course never.
    expect(plan.spots.filter((s) => s.route === 1 && s.stampable).map((s) => s.nameJa)).toEqual(["行者堂", "友ヶ島・序品"]);
  });

  test("a hand-placed point fills a mound with no position, by its chapter, and never replaces one", () => {
    const point = { name: "第1経塚・序品", lat: 34.29, lng: 135.02 };
    const filled = planLoad({ stops, facilities: [], mounds: [point], existing: [mound()] }).spots.find((s) => s.kind === "mound")!;
    expect([filled.lat, filled.lng]).toEqual([34.29, 135.02]);
    const kept = planLoad({ stops, facilities: [], mounds: [point], existing: [mound({ lat: 1, lng: 2 })] }).spots.find((s) => s.kind === "mound")!;
    expect([kept.lat, kept.lng]).toEqual([1, 2]);
  });

  test("running it again finds the places it loaded before", () => {
    const before = planLoad({ stops, facilities, mounds: [], existing: [] });
    const saved: Existing[] = before.spots.map((s, i) => ({ id: `e${i}`, route: s.route, nameJa: s.nameJa, kind: s.kind, lat: s.lat, lng: s.lng, sortOrder: i + 1 }));
    const again = planLoad({ stops, facilities, mounds: [], existing: saved });
    expect(again.spots.filter((s) => !s.existing)).toEqual([]);
  });
});

describe("parseMoundPoints", () => {
  test("takes named points and leaves search results and areas", () => {
    const json = JSON.stringify({
      features: [
        { id: "神福寺跡・方便品", geometry: { type: "Point", coordinates: [135.1, 34.2] } },
        { properties: { label: "a town" }, geometry: { type: "Point", coordinates: [135, 34] } },
        { id: "コース１", geometry: { type: "Polygon", coordinates: [] } },
      ],
    });
    expect(parseMoundPoints(json)).toEqual([{ name: "神福寺跡・方便品", lat: 34.2, lng: 135.1 }]);
  });
});

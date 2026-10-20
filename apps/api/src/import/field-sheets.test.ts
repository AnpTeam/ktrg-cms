import { describe, expect, test } from "bun:test";
import { kindOfStop, parseFacilities, parseMoundPoints, parseStops, planLoad, planPlaces, type Existing } from "./field-sheets";

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

const PLACES = `sample,place_id,category,name_ja,name_en,ｚ,,near_spot_ja,coord_source,lat,lng,phone,opening_hours_ja,opening_hours_en,status,last_verified,listing_permission
見本,場所ID,種類,名前,名前,コース番号,Index,近い,出どころ,緯度,経度,電話,時間,time,状態,日,了承
,1,トイレ,公衆トイレ,Public toilet,1,1,行者堂,地図アプリで確認,34.21,135.21,,,,営業中・利用可,2026/10/17,不要（公共施設）
,2,飲食店,食堂,Cafe,1,1,行者堂,地図アプリで確認,34.22,135.22,0734590173,9時～18時,9:00 - 18:00,休業中,2026/1/5,未確認
,3,薬局,薬屋,Drug,1,S,加太駅,地図アプリで確認,34.11,135.11,,,,,,未確認
,4,,,,,,,,,,,,,,,`;

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

  test("keeps the seeded mound, drops the return row and a position copied to two places", () => {
    const plan = planLoad({ stops, mounds: [], existing: [mound()] });
    expect(plan.spots.filter((s) => s.route === 1).map((s) => s.nameJa)).toEqual(["加太駅", "行者堂", "友ヶ島・序品"]);
    const m = plan.spots.find((s) => s.kind === "mound")!;
    expect(m.existing?.id).toBe("m1");
    expect(m.stampable).toBe(true);
    // 2.1 and 2.2 share one position: neither gets it.
    expect(plan.spots.filter((s) => s.route === 2).map((s) => s.lat)).toEqual([null, null]);
    // Only the sheet's スポット rows (and the mound) can be stamped; places along the course never.
    expect(plan.spots.filter((s) => s.route === 1 && s.stampable).map((s) => s.nameJa)).toEqual(["行者堂", "友ヶ島・序品"]);
  });

  test("a hand-placed point fills a mound with no position, by its chapter, and never replaces one", () => {
    const point = { name: "第1経塚・序品", lat: 34.29, lng: 135.02 };
    const filled = planLoad({ stops, mounds: [point], existing: [mound()] }).spots.find((s) => s.kind === "mound")!;
    expect([filled.lat, filled.lng]).toEqual([34.29, 135.02]);
    const kept = planLoad({ stops, mounds: [point], existing: [mound({ lat: 1, lng: 2 })] }).spots.find((s) => s.kind === "mound")!;
    expect([kept.lat, kept.lng]).toEqual([1, 2]);
  });

  test("running it again finds the places it loaded before", () => {
    const before = planLoad({ stops, mounds: [], existing: [] });
    const saved: Existing[] = before.spots.map((s, i) => ({ id: `e${i}`, route: s.route, nameJa: s.nameJa, kind: s.kind, lat: s.lat, lng: s.lng, sortOrder: i + 1 }));
    const again = planLoad({ stops, mounds: [], existing: saved });
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

describe("planPlaces", () => {
  const rows = parseFacilities(PLACES);
  test("reads the sheet's words into directory entries: a draft, the sheet's claim kept only as a note", () => {
    const { places } = planPlaces(rows, []);
    expect(places.map((p) => [p.nameJa, p.category, p.status, p.lastVerified, p.listingConfirmed])).toEqual([
      ["公衆トイレ", "toilet", "open", "2026-10-17", true],
      ["食堂", "restaurant", "closed", "2026-01-05", false],
      ["薬屋", "other", "unknown", null, false],
    ]);
    expect(places[1]).toMatchObject({ phone: "0734590173", hoursJa: "9時～18時", hoursEn: "9:00 - 18:00" });
    expect(places[0]!.positionSource).toContain("未確認");
    expect(places[0]!.listingNote).toBe("不要（公共施設）");
  });
  test("a place already in the directory is not added again", () => {
    const saved = planPlaces(rows, []).places.map((p, i) => ({ id: "p" + i, route: p.route, category: p.category, nameJa: p.nameJa, lat: p.lat, lng: p.lng }));
    expect(planPlaces(rows, saved)).toMatchObject({ places: [], skipped: 3 });
  });
});

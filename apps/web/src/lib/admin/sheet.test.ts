import { describe, expect, test } from "bun:test";
import { estimateWrites, photoNamesIn, readPlaceRows, readRouteRows, runImport, type ImportApi, type SheetRow } from "./sheet";
import type { AdminRoute, AdminSpot } from "./types";

const row = (line: number, cells: Record<string, string>): SheetRow => ({ line, cells });

describe("readRouteRows", () => {
  test("reads a row, skips blank rows and blank cells, and sorts by number", () => {
    const r = readRouteRows([
      row(3, { ルート番号: "２", "名前（日本語）": "二番", 都道府県: "和歌山", "距離（km）": "12.5", "登る高さ（m）": "1,200" }),
      row(2, { ルート番号: "1", "名前（日本語）": "一番", 都道府県: "大阪府" }),
      row(4, { ルート番号: "", "名前（日本語）": "" }),
    ]);
    expect(r.problems).toEqual([]);
    expect(r.rows.map((x) => x.number)).toEqual([1, 2]);
    expect(r.rows[1]!.changes).toEqual({ nameJa: "二番", prefecture: "wakayama", distanceKm: 12.5, elevationGainM: 1200 });
    expect(r.rows[0]!.changes).toEqual({ nameJa: "一番", prefecture: "osaka" }); // blank cells are not "empty it"
  });

  test("a row with a wrong cell is left out whole, with the column named", () => {
    const r = readRouteRows([
      row(2, { ルート番号: "1", 都道府県: "東京" }),
      row(3, { ルート番号: "2", "登る高さ（m）": "高い" }),
      row(4, { "名前（日本語）": "番号なし" }),
      row(5, { ルート番号: "5" }),
      row(6, { ルート番号: "5" }),
    ]);
    expect(r.problems).toEqual([
      { sheet: "route", line: 2, column: "都道府県", problem: "prefecture" },
      { sheet: "route", line: 3, column: "登る高さ（m）", problem: "whole" },
      { sheet: "route", line: 4, column: "ルート番号", problem: "missing" },
      { sheet: "route", line: 6, column: "ルート番号", problem: "duplicate" },
    ]);
    expect(r.rows.map((x) => x.number)).toEqual([5]);
  });
});

describe("readPlaceRows", () => {
  test("a position needs both latitude and longitude, within range", () => {
    const r = readPlaceRows([
      row(2, { ルート番号: "1", 場所の番号: "1", 緯度: "34.3" }),
      row(3, { ルート番号: "1", 場所の番号: "2", 緯度: "134", 経度: "135" }),
      row(4, { ルート番号: "1", 場所の番号: "3", 緯度: "34.3", 経度: "135.1", 位置の出どころ: "公式サイト" }),
    ]);
    expect(r.problems.map((p) => [p.line, p.column, p.problem])).toEqual([
      [2, "経度", "pair"],
      [3, "緯度", "range"],
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.changes).toEqual({ lat: 34.3, lng: 135.1, positionSource: "公式サイト" });
  });
});

describe("photo names", () => {
  test("links are not files; names are counted once, case-insensitively", () => {
    const routes = [{ line: 2, number: 1, photo: "A.jpg", changes: {} }, { line: 3, number: 2, photo: "https://x.example/a.jpg", changes: {} }];
    const places = [{ line: 2, routeNumber: 1, number: 1, photo: "a.JPG", changes: {} }, { line: 3, routeNumber: 1, number: 2, photo: "b.png", changes: {} }];
    expect(photoNamesIn(routes, places)).toEqual(["a.jpg", "b.png"]);
    expect(estimateWrites(routes, places, new Set(["a.jpg"]))).toBe(5); // 4 rows + 1 upload
  });
});

// ---- runImport with a fake API -------------------------------------------------------------------
const route = (id: string, order: number): AdminRoute => ({ id, nameJa: `r${order}`, updatedAt: "t0" }) as AdminRoute;
const stamp = (id: string, sortOrder: number, lat: number | null, lng: number | null): AdminSpot =>
  ({ id, sortOrder, kind: "stamp", lat, lng, updatedAt: "s0" }) as AdminSpot;

function fakeApi(spots: AdminSpot[] = []) {
  const calls: string[] = [];
  const api: ImportApi = {
    async createRoute(b) {
      calls.push(`createRoute ${b.nameJa} ${b.photoUrl ?? ""}`.trim());
      return { ok: true, value: { id: "new", updatedAt: "t1" } as AdminRoute };
    },
    async updateRoute(id, _u, c) {
      calls.push(`updateRoute ${id} ${JSON.stringify(c)}`);
      return { ok: true, value: { id, updatedAt: "t1" } as AdminRoute };
    },
    async getRoute() {
      return { ok: true, value: { spots } };
    },
    async createSpot(rid, b) {
      calls.push(`createSpot ${rid} ${JSON.stringify(b)}`);
      return { ok: true, value: stamp("ns", 9, null, null) };
    },
    async updateSpot(id, _u, c) {
      calls.push(`updateSpot ${id} ${JSON.stringify(c)}`);
      return { ok: true, value: stamp(id, 1, null, null) };
    },
    async uploadPhoto(f) {
      calls.push(`upload ${f.name}`);
      return { ok: true, value: `https://cdn.example/${f.name}` };
    },
  };
  return { api, calls };
}

describe("runImport", () => {
  test("updates a route by its number, creates the next one, leaves a gap out", async () => {
    const { api, calls } = fakeApi();
    const report = await runImport(
      {
        routes: [
          { line: 2, number: 1, changes: { nameEn: "One" } },
          { line: 3, number: 2, changes: { nameJa: "二" }, photo: "two.jpg" },
          { line: 4, number: 4, changes: { nameJa: "四" } },
          { line: 5, number: 3, changes: {} },
        ].sort((a, b) => a.number - b.number),
        places: [],
        existing: [route("r1", 1)],
        photos: new Map([["two.jpg", new File(["x"], "two.jpg")]]),
      },
      api,
    );
    expect(calls).toEqual(['updateRoute r1 {"nameEn":"One"}', "upload two.jpg", "createRoute 二 https://cdn.example/two.jpg"]);
    expect(report.map((r) => [r.line, r.status, r.reason])).toEqual([
      [2, "updated", undefined],
      [3, "created", undefined],
      [5, "skipped", "name_required"], // number 3 is next but has no Japanese name to create it with
      [4, "skipped", "route_gap"],
    ]);
  });

  test("a photo that is not among the chosen files is reported but the row still saves", async () => {
    const { api } = fakeApi();
    const report = await runImport({ routes: [{ line: 2, number: 1, photo: "gone.jpg", changes: { nameEn: "x" } }], places: [], existing: [route("r1", 1)], photos: new Map() }, api);
    expect(report[0]).toMatchObject({ status: "updated", photo: { name: "gone.jpg", reason: "photo_missing" } });
  });

  test("places: update by number among stamp places, send a position only when it moved, create the next", async () => {
    const { api, calls } = fakeApi([stamp("p1", 1, 34.1, 135.1), { ...stamp("t1", 2, null, null), kind: "toilet" }, stamp("p2", 3, null, null)]);
    const report = await runImport(
      {
        routes: [],
        places: [
          { line: 2, routeNumber: 1, number: 1, changes: { nameEn: "same", lat: 34.1, lng: 135.1 } },
          { line: 3, routeNumber: 1, number: 2, changes: { lat: 34.2, lng: 135.2 } },
          { line: 4, routeNumber: 1, number: 3, changes: { nameJa: "新しい", lat: 34.3, lng: 135.3 } },
          { line: 5, routeNumber: 1, number: 5, changes: { nameJa: "とんだ" } },
          { line: 6, routeNumber: 2, number: 1, changes: { nameJa: "ルートがない" } },
        ],
        existing: [route("r1", 1)],
        photos: new Map(),
      },
      api,
    );
    expect(calls).toEqual([
      'updateSpot p1 {"nameEn":"same"}',
      'updateSpot p2 {"lat":34.2,"lng":135.2}',
      'createSpot r1 {"nameJa":"新しい","lat":34.3,"lng":135.3,"kind":"stamp"}',
    ]);
    expect(report.map((r) => r.status + (r.reason ? `:${r.reason}` : ""))).toEqual(["updated", "updated", "created", "skipped:place_gap", "skipped:route_missing"]);
  });

  test("a refusal from the API leaves only that row out", async () => {
    const { api } = fakeApi([stamp("p1", 1, null, null)]);
    api.updateSpot = async () => ({ ok: false, key: "position_not_verified" });
    const report = await runImport(
      { routes: [], places: [{ line: 2, routeNumber: 1, number: 1, changes: { lat: 1, lng: 1 } }, { line: 3, routeNumber: 1, number: 2, changes: { nameJa: "次" } }], existing: [route("r1", 1)], photos: new Map() },
      api,
    );
    expect(report.map((r) => [r.status, r.reason])).toEqual([["skipped", "position_not_verified"], ["created", undefined]]);
  });
});

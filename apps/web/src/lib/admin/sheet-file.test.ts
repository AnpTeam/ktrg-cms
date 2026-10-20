import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { HELP_SHEET, PLACE_COLUMNS, PLACE_SHEET, readPlaceRows, readRouteRows, ROUTE_COLUMNS, ROUTE_SHEET } from "./sheet";
import { readSheets, templateBlob } from "./sheet-file";

const fileOf = (bytes: BlobPart) => new File([bytes], "x.xlsx");

describe("the template", () => {
  test("has the two sheets with every heading, a how-to sheet, and no data rows", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await templateBlob()).arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual([ROUTE_SHEET, PLACE_SHEET, HELP_SHEET]);
    expect(wb.getWorksheet(ROUTE_SHEET)!.getRow(1).values).toEqual([undefined, ...ROUTE_COLUMNS.map((c) => c.header)]);
    expect(wb.getWorksheet(PLACE_SHEET)!.getRow(1).values).toEqual([undefined, ...PLACE_COLUMNS.map((c) => c.header)]);
    const read = await readSheets(fileOf(await (await templateBlob()).arrayBuffer()));
    expect(readRouteRows(read!.routes).rows).toEqual([]);
  });
});

describe("readSheets", () => {
  test("reads a filled-in sheet back, numbers and all", async () => {
    const wb = new ExcelJS.Workbook();
    const routes = wb.addWorksheet(ROUTE_SHEET);
    routes.addRow(ROUTE_COLUMNS.map((c) => c.header));
    routes.addRow([1, "友ヶ島", "Tomogashima", "和歌山県", "和歌山市", 12.5, 300, "ふつう", 180, "", "", "", "", "", "", "", "a.jpg"]);
    const places = wb.addWorksheet(PLACE_SHEET);
    places.addRow(PLACE_COLUMNS.map((c) => c.header));
    places.addRow([1, 1, "虎島", "", "", "", 34.28, 135.02, "公式サイト", ""]);
    const read = await readSheets(fileOf(await wb.xlsx.writeBuffer()));
    expect(readRouteRows(read!.routes).rows[0]).toMatchObject({
      number: 1,
      photo: "a.jpg",
      changes: { nameJa: "友ヶ島", nameEn: "Tomogashima", prefecture: "wakayama", distanceKm: 12.5, elevationGainM: 300, expectedTimeMin: 180 },
    });
    expect(readPlaceRows(read!.places).rows[0]!.changes).toEqual({ nameJa: "虎島", lat: 34.28, lng: 135.02, positionSource: "公式サイト" });
  });

  test("a file that is not made from the template is refused", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1").addRow(["a"]);
    expect(await readSheets(fileOf(await wb.xlsx.writeBuffer()))).toBeNull();
    expect(await readSheets(fileOf("not a zip"))).toBeNull();
  });
});

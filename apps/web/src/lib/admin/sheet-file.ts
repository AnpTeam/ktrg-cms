import { HELP_SHEET, KIND_NAMES, PLACE_COLUMNS, PLACE_SHEET, PREFECTURE_NAMES, ROUTE_COLUMNS, ROUTE_SHEET, type SheetRow } from "./sheet";

// Reading and writing the import's .xlsx file (browser only). exceljs is loaded when a button is pressed, so it is
// not part of the page's normal download.

const loadExcel = async () => {
  const mod = await import("exceljs");
  return mod.default ?? mod;
};

const HELP: readonly string[] = [
  "ルートの取り込みシートの書き方",
  "",
  "・「ルート」シートに 1 ルート 1 行、「経由地」シートに 1 経由地 1 行で書きます。1 行目の見出しは変えないでください。",
  "・ルート番号は、歩く順の番号です（1 が最初のルート）。今あるルートはその番号の行で上書きされ、一番後ろの次の番号なら新しいルートが作られます。",
  "・空のセルは「今のまま」です。空にしたいときは、サイトの編集画面で消してください。",
  "・新しいルートや経由地を作る行には、名前（日本語）が必要です。",
  "・経由地の番号は、そのルートの経由地を歩く順に数えた番号です（1 が最初。曲がり角やトイレも数えます）。",
  "・種類は、次のどれかで書きます：" + Object.values(KIND_NAMES).join("、") + "。",
  "・スタンプを押せるは、「はい」か「いいえ」です。空のときは、種類で決まります（寺社・経塚・見どころ・その他は「はい」、それ以外は「いいえ」）。「はい」の経由地を公開するには、現地の許可の確認が必要です。",
  "・写真は、ファイル名（例：route-01.jpg）か、https で始まるリンクを書きます。ファイル名の場合は、取り込むときに同じ名前の写真ファイルを一緒に選んでください。JPEG・PNG・WebP、1 枚 4 MB までです。",
  "・緯度・経度は、両方書いたときだけ取り込まれます。取り込んだ位置は「位置を確認していない」状態になり、公開できません。出どころを調べて、サイトの編集画面で「位置を確認した」にしてください。",
  "・取り込みでは、何も公開されません。公開は、サイトの編集画面で行います。",
  "・都道府県は、次のどれかです：" + Object.values(PREFECTURE_NAMES).join("、"),
];

/** The template: the two sheets with their headings, a drop-down for the prefecture, and a sheet that says how to fill it in. */
export async function templateBlob(): Promise<Blob> {
  const Excel = await loadExcel();
  const wb = new Excel.Workbook();
  for (const [name, columns] of [[ROUTE_SHEET, ROUTE_COLUMNS], [PLACE_SHEET, PLACE_COLUMNS]] as const) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length * 2.2) }));
    ws.getRow(1).font = { bold: true };
    // A drop-down for the columns that take one of a few words.
    const choices = { prefecture: Object.values(PREFECTURE_NAMES), kind: Object.values(KIND_NAMES), yesno: ["はい", "いいえ"] } as const;
    columns.forEach((c, i) => {
      if (!(c.kind in choices)) return;
      for (let r = 2; r <= 500; r++) {
        ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${choices[c.kind as keyof typeof choices].join(",")}"`] };
      }
    });
  }
  const help = wb.addWorksheet(HELP_SHEET);
  help.getColumn(1).width = 110;
  HELP.forEach((line, i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 14 };
  });
  const bytes = await wb.xlsx.writeBuffer();
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** The rows of the two sheets, or null when the file is not one made from the template. */
export async function readSheets(file: File): Promise<{ routes: SheetRow[]; places: SheetRow[] } | null> {
  const Excel = await loadExcel();
  const wb = new Excel.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return null;
  }
  const routes = wb.getWorksheet(ROUTE_SHEET);
  const places = wb.getWorksheet(PLACE_SHEET);
  if (!routes || !places) return null;
  const rowsOf = (ws: typeof routes): SheetRow[] => {
    const headers = new Map<number, string>();
    ws.getRow(1).eachCell((cell, col) => headers.set(col, cell.text.trim()));
    const out: SheetRow[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const cells: Record<string, string> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const header = headers.get(col);
        if (header) cells[header] = cell.text;
      });
      out.push({ line: r, cells });
    }
    return out;
  };
  return { routes: rowsOf(routes), places: rowsOf(places) };
}

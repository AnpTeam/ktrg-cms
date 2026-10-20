import type { ErrorKey } from "../api-error";
import type { AdminRoute, AdminSpot, Prefecture } from "./types";

// The spreadsheet import (admin routes page): the columns of the template, reading its rows, and running the
// import through the same admin API the editor uses. No file or network code here, so it is all testable; the
// .xlsx reading and writing is in sheet-file.ts and the screen in components/admin/RouteImport.tsx.
// A blank cell means "leave as it is", never "empty it". Nothing is ever published by an import, and coordinates
// that come in are never marked as checked.

export const ROUTE_SHEET = "ルート";
export const PLACE_SHEET = "場所";
export const HELP_SHEET = "書き方";

/** The API allows 300 writes per 15 minutes per admin; one import stays well under it. */
export const IMPORT_WRITE_LIMIT = 250;

type Kind = "text" | "whole" | "number" | "prefecture" | "lat" | "lng";
interface Column {
  key: string;
  header: string;
  kind: Kind;
}

export const ROUTE_COLUMNS: readonly Column[] = [
  { key: "number", header: "ルート番号", kind: "whole" },
  { key: "nameJa", header: "名前（日本語）", kind: "text" },
  { key: "nameEn", header: "名前（英語）", kind: "text" },
  { key: "prefecture", header: "都道府県", kind: "prefecture" },
  { key: "municipality", header: "市町村", kind: "text" },
  { key: "distanceKm", header: "距離（km）", kind: "number" },
  { key: "elevationGainM", header: "登る高さ（m）", kind: "whole" },
  { key: "difficulty", header: "難しさ", kind: "text" },
  { key: "expectedTimeMin", header: "かかる時間（分）", kind: "whole" },
  { key: "descriptionJa", header: "説明（日本語）", kind: "text" },
  { key: "descriptionEn", header: "説明（英語）", kind: "text" },
  { key: "historyJa", header: "歴史（日本語）", kind: "text" },
  { key: "historyEn", header: "歴史（英語）", kind: "text" },
  { key: "accessJa", header: "行き方（日本語）", kind: "text" },
  { key: "accessEn", header: "行き方（英語）", kind: "text" },
  { key: "videoUrl", header: "動画のリンク", kind: "text" },
  { key: "photo", header: "写真（ファイル名かリンク）", kind: "text" },
];

export const PLACE_COLUMNS: readonly Column[] = [
  { key: "routeNumber", header: "ルート番号", kind: "whole" },
  { key: "number", header: "場所の番号", kind: "whole" },
  { key: "nameJa", header: "名前（日本語）", kind: "text" },
  { key: "nameEn", header: "名前（英語）", kind: "text" },
  { key: "descriptionJa", header: "説明（日本語）", kind: "text" },
  { key: "descriptionEn", header: "説明（英語）", kind: "text" },
  { key: "lat", header: "緯度", kind: "lat" },
  { key: "lng", header: "経度", kind: "lng" },
  { key: "positionSource", header: "位置の出どころ", kind: "text" },
  { key: "photo", header: "写真（ファイル名かリンク）", kind: "text" },
];

export const PREFECTURE_NAMES: Record<Prefecture, string> = { osaka: "大阪府", wakayama: "和歌山県", nara: "奈良県" };

/** One row as read from the file: the cell text under each header, and the row's number in the sheet. */
export interface SheetRow {
  line: number;
  cells: Record<string, string>;
}

export type ProblemKind = "whole" | "number" | "prefecture" | "range" | "pair" | "duplicate" | "missing";
export interface RowProblem {
  sheet: "route" | "place";
  line: number;
  column: string;
  problem: ProblemKind;
}

export type RouteChanges = Partial<
  Pick<
    AdminRoute,
    | "nameJa" | "nameEn" | "prefecture" | "municipality" | "distanceKm" | "elevationGainM" | "difficulty" | "expectedTimeMin"
    | "descriptionJa" | "descriptionEn" | "historyJa" | "historyEn" | "accessJa" | "accessEn" | "videoUrl"
  >
>;
export type PlaceChanges = Partial<Pick<AdminSpot, "nameJa" | "nameEn" | "descriptionJa" | "descriptionEn" | "lat" | "lng" | "positionSource">>;

export interface RouteRow {
  line: number;
  number: number;
  /** A photo file name or an https link, as written in the sheet. */
  photo?: string;
  changes: RouteChanges;
}
export interface PlaceRow {
  line: number;
  routeNumber: number;
  number: number;
  photo?: string;
  changes: PlaceChanges;
}

const WHOLE_MAX = 100000;

/** Full-width digits and signs are common in Japanese spreadsheets, so numbers are read after NFKC. */
const plainNumber = (s: string) => Number(s.normalize("NFKC").replace(/[,\s]/g, ""));

function prefectureOf(s: string): Prefecture | null {
  const v = s.normalize("NFKC").trim().toLowerCase();
  for (const [key, name] of Object.entries(PREFECTURE_NAMES)) {
    if (v === key || v === name || v === name.slice(0, -1)) return key as Prefecture;
  }
  return null;
}

type Value = string | number | undefined;

/** The typed values of a row's cells (blank = undefined), plus what was wrong with the others. */
function readCells(columns: readonly Column[], row: SheetRow, sheet: "route" | "place", problems: RowProblem[]): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const c of columns) {
    const raw = (row.cells[c.header] ?? "").trim();
    if (raw === "") continue;
    const bad = (problem: ProblemKind) => problems.push({ sheet, line: row.line, column: c.header, problem });
    if (c.kind === "text") out[c.key] = raw;
    else if (c.kind === "prefecture") {
      const p = prefectureOf(raw);
      if (p) out[c.key] = p;
      else bad("prefecture");
    } else {
      const n = plainNumber(raw);
      if (!Number.isFinite(n)) bad(c.kind === "whole" ? "whole" : "number");
      else if (c.kind === "whole" && (!Number.isInteger(n) || n < 0 || n > WHOLE_MAX)) bad("whole");
      else if (c.kind === "number" && (n < 0 || n > 2000)) bad("range");
      else if (c.kind === "lat" && Math.abs(n) > 90) bad("range");
      else if (c.kind === "lng" && Math.abs(n) > 180) bad("range");
      else out[c.key] = n;
    }
  }
  return out;
}

const blank = (row: SheetRow) => Object.values(row.cells).every((v) => v.trim() === "");

/** `changes` without the keys that are not set (a blank cell must not reach the API as "empty it"). */
function pick(values: Record<string, Value>, skip: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== undefined && !skip.includes(k)));
}

export function readRouteRows(rows: readonly SheetRow[]): { rows: RouteRow[]; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const out: RouteRow[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (blank(row)) continue;
    const before = problems.length;
    const v = readCells(ROUTE_COLUMNS, row, "route", problems);
    const number = v.number;
    if (typeof number !== "number" || number < 1) {
      problems.push({ sheet: "route", line: row.line, column: "ルート番号", problem: number === undefined ? "missing" : "whole" });
      continue;
    }
    if (seen.has(number)) {
      problems.push({ sheet: "route", line: row.line, column: "ルート番号", problem: "duplicate" });
      continue;
    }
    if (problems.length > before) continue; // a row with a wrong cell is left out whole, so nothing half-filled comes in
    seen.add(number);
    out.push({ line: row.line, number, photo: typeof v.photo === "string" ? v.photo : undefined, changes: pick(v, ["number", "photo"]) as RouteChanges });
  }
  return { rows: out.sort((a, b) => a.number - b.number), problems };
}

export function readPlaceRows(rows: readonly SheetRow[]): { rows: PlaceRow[]; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const out: PlaceRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (blank(row)) continue;
    const before = problems.length;
    const v = readCells(PLACE_COLUMNS, row, "place", problems);
    for (const [key, header] of [["routeNumber", "ルート番号"], ["number", "場所の番号"]] as const) {
      const n = v[key];
      if (typeof n !== "number" || n < 1) problems.push({ sheet: "place", line: row.line, column: header, problem: n === undefined ? "missing" : "whole" });
    }
    const noLat = (row.cells["緯度"] ?? "").trim() === "";
    if (noLat !== ((row.cells["経度"] ?? "").trim() === "")) problems.push({ sheet: "place", line: row.line, column: noLat ? "緯度" : "経度", problem: "pair" });
    if (problems.length > before) continue;
    const key = `${v.routeNumber}-${v.number}`;
    if (seen.has(key)) {
      problems.push({ sheet: "place", line: row.line, column: "場所の番号", problem: "duplicate" });
      continue;
    }
    seen.add(key);
    out.push({
      line: row.line,
      routeNumber: v.routeNumber as number,
      number: v.number as number,
      photo: typeof v.photo === "string" ? v.photo : undefined,
      changes: pick(v, ["routeNumber", "number", "photo"]) as PlaceChanges,
    });
  }
  return { rows: out.sort((a, b) => a.routeNumber - b.routeNumber || a.number - b.number), problems };
}

const isLink = (s: string) => /^https:\/\//i.test(s);

/** The photo files a sheet asks for: written as a file name (not a link). */
export function photoNamesIn(routes: readonly RouteRow[], places: readonly PlaceRow[]): string[] {
  const names = [...routes, ...places].map((r) => r.photo).filter((p): p is string => !!p && !isLink(p));
  return [...new Set(names.map((n) => n.toLowerCase()))];
}

/** How many writes the import will make: one per row, plus one per photo file that has to be uploaded. */
export function estimateWrites(routes: readonly RouteRow[], places: readonly PlaceRow[], files: ReadonlySet<string>): number {
  return routes.length + places.length + photoNamesIn(routes, places).filter((n) => files.has(n)).length;
}

// ---- running the import -------------------------------------------------------------------------

type Res<T> = { ok: true; value: T } | { ok: false; key: ErrorKey };

/** What the import needs from the admin API; the screen fills it with the typed client, the tests with a fake. */
export interface ImportApi {
  createRoute(body: RouteChanges & { nameJa: string; photoUrl?: string }): Promise<Res<AdminRoute>>;
  updateRoute(id: string, updatedAt: string, changes: RouteChanges & { photoUrl?: string }): Promise<Res<AdminRoute>>;
  getRoute(id: string): Promise<Res<{ spots: AdminSpot[] }>>;
  createSpot(routeId: string, body: PlaceChanges & { nameJa: string; kind: "stamp"; photoUrl?: string }): Promise<Res<AdminSpot>>;
  updateSpot(id: string, updatedAt: string, changes: PlaceChanges & { photoUrl?: string }): Promise<Res<AdminSpot>>;
  uploadPhoto(file: File): Promise<Res<string>>;
}

export type Skip = ErrorKey | "name_required" | "route_gap" | "route_missing" | "place_gap";
export interface ReportItem {
  sheet: "route" | "place";
  line: number;
  /** Saved (created or updated), or left out because of `reason`. */
  status: "created" | "updated" | "skipped";
  reason?: Skip;
  /** The row was saved but its photo was not: the photo name, and why. */
  photo?: { name: string; reason: ErrorKey | "photo_missing" };
}

/**
 * Applies the rows in walking order. Routes are numbered by their place in the list (1 is the first), places by
 * their place among the route's stamp places. A number one past the end creates; further past is a gap and is left
 * out. Each row is its own save, so a refusal (for example a place that is published and whose position changed)
 * leaves only that row out and the rest goes on.
 */
export async function runImport(
  input: { routes: readonly RouteRow[]; places: readonly PlaceRow[]; existing: readonly AdminRoute[]; photos: ReadonlyMap<string, File> },
  api: ImportApi,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<ReportItem[]> {
  const report: ReportItem[] = [];
  const total = input.routes.length + input.places.length;
  let done = 0;
  const step = () => onProgress(++done, total);

  const uploaded = new Map<string, Res<string>>();
  async function photoOf(name: string | undefined): Promise<{ url?: string; lost?: ReportItem["photo"] }> {
    if (!name) return {};
    if (isLink(name)) return { url: name };
    const key = name.toLowerCase();
    const file = input.photos.get(key);
    if (!file) return { lost: { name, reason: "photo_missing" } };
    let r = uploaded.get(key);
    if (!r) uploaded.set(key, (r = await api.uploadPhoto(file)));
    return r.ok ? { url: r.value } : { lost: { name, reason: r.key } };
  }

  const routes = input.existing.map((r) => ({ id: r.id, updatedAt: r.updatedAt })); // by walking order
  for (const row of input.routes) {
    const photo = await photoOf(row.photo);
    const skip = (reason: Skip) => report.push({ sheet: "route", line: row.line, status: "skipped", reason });
    const photoUrl = photo.url ? { photoUrl: photo.url } : {};
    const current = routes[row.number - 1];
    if (current) {
      const r = await api.updateRoute(current.id, current.updatedAt, { ...row.changes, ...photoUrl });
      if (r.ok) {
        routes[row.number - 1] = { id: r.value.id, updatedAt: r.value.updatedAt };
        report.push({ sheet: "route", line: row.line, status: "updated", photo: photo.lost });
      } else skip(r.key);
    } else if (row.number !== routes.length + 1) skip("route_gap");
    else if (!row.changes.nameJa) skip("name_required");
    else {
      const r = await api.createRoute({ ...row.changes, nameJa: row.changes.nameJa, ...photoUrl });
      if (r.ok) {
        routes.push({ id: r.value.id, updatedAt: r.value.updatedAt });
        report.push({ sheet: "route", line: row.line, status: "created", photo: photo.lost });
      } else skip(r.key);
    }
    step();
  }

  const stamps = new Map<number, AdminSpot[] | null>(); // a route's stamp places, loaded once; null = could not load
  for (const row of input.places) {
    const skip = (reason: Skip) => report.push({ sheet: "place", line: row.line, status: "skipped", reason });
    const route = routes[row.routeNumber - 1];
    if (!route) {
      skip("route_missing");
      step();
      continue;
    }
    if (!stamps.has(row.routeNumber)) {
      const found = await api.getRoute(route.id);
      stamps.set(row.routeNumber, found.ok ? found.value.spots.filter((s) => s.kind === "stamp").sort((a, b) => a.sortOrder - b.sortOrder) : null);
    }
    const list = stamps.get(row.routeNumber);
    if (!list) {
      skip("not_found");
      step();
      continue;
    }
    const photo = await photoOf(row.photo);
    const photoUrl = photo.url ? { photoUrl: photo.url } : {};
    const current = list[row.number - 1];
    if (current) {
      const { lat, lng, ...rest } = row.changes;
      // Send a position only when it differs, so a published place whose position is unchanged still saves.
      const moved = lat !== undefined && (lat !== current.lat || lng !== current.lng);
      const r = await api.updateSpot(current.id, current.updatedAt, { ...rest, ...(moved ? { lat, lng } : {}), ...photoUrl });
      if (r.ok) {
        list[row.number - 1] = r.value;
        report.push({ sheet: "place", line: row.line, status: "updated", photo: photo.lost });
      } else skip(r.key);
    } else if (row.number !== list.length + 1) skip("place_gap");
    else if (!row.changes.nameJa) skip("name_required");
    else {
      const r = await api.createSpot(route.id, { ...row.changes, nameJa: row.changes.nameJa, kind: "stamp", ...photoUrl });
      if (r.ok) {
        list.push(r.value);
        report.push({ sheet: "place", line: row.line, status: "created", photo: photo.lost });
      } else skip(r.key);
    }
    step();
  }
  return report;
}

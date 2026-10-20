// Reads the two CSV sheets the field team fills in (the stops of a course in Navivi's layout, and the places along it)
// and plans how they become waypoints. Pure functions, no I/O: the CLI (field-sheets-cli.ts) reads the files and the
// database and applies the plan. What comes out is a DRAFT: positions are never marked as checked, nothing is published,
// and a position shared by several different places is dropped (it was copied, not measured).
import { parseCsv } from "./navivi";

export type SpotKindName = "temple" | "mound" | "view" | "turn" | "danger" | "toilet" | "rest_area" | "drinking_water" | "vending_machine" | "bus_stop" | "station" | "parking" | "other";
export type StopType = "start" | "end" | "stamp" | "optional" | "info" | "return";

export interface StopRow {
  route: number;
  /** The sheet's own number, such as "1.6.1". */
  code: string;
  /** The "#" column: S, E, 1, +1, i ... */
  label: string;
  type: StopType;
  nameJa: string;
  nameEn: string | null;
  placeType: string;
  lat: number | null;
  lng: number | null;
}
export interface RouteName {
  route: number;
  nameJa: string;
  nameEn: string | null;
}
export interface FacilityRow {
  route: number;
  /** Which stop it is near: the "#" label of that stop (S, 1, +3 ...). */
  near: string;
  categoryJa: string;
  nameJa: string;
  nameEn: string | null;
  lat: number | null;
  lng: number | null;
  /** The sheet's own words for where the position came from. */
  coordSource: string;
}
export interface MoundPoint {
  name: string;
  lat: number;
  lng: number;
}

const TYPES: Record<string, StopType> = { 始: "start", 終: "end", スポット: "stamp", 任意: "optional", 情報: "info", 復帰: "return" };
const num = (s: string | undefined) => {
  const v = (s ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The stops sheet: a Japanese row then an English row for each stop; a course heading is a row with a whole number. */
export function parseStops(text: string): { routes: RouteName[]; stops: StopRow[]; skippedNotes: number } {
  const rows = parseCsv(text).slice(1);
  const routes: RouteName[] = [];
  const stops: StopRow[] = [];
  let skippedNotes = 0;
  let route = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const code = (r[0] ?? "").trim();
    if (code === "" && (r[1] ?? "").trim() === "注意") {
      skippedNotes++;
      i++; // its English row
      continue;
    }
    if (code === "") continue; // an English row that was not consumed
    const en = (rows[i + 1]?.[0] ?? "").trim() === "" ? rows[i + 1] : undefined;
    if (en) i++;
    const nameEn = (en?.[2] ?? "").trim() || null;
    if (/^\d+$/.test(code)) {
      route = Number(code);
      routes.push({ route, nameJa: (r[2] ?? "").trim(), nameEn });
      continue;
    }
    const type = TYPES[(r[1] ?? "").trim()];
    if (!type || route === 0) continue;
    stops.push({
      route,
      code,
      label: (r[3] ?? "").trim(),
      type,
      nameJa: (r[2] ?? "").trim(),
      nameEn,
      placeType: (r[4] ?? "").trim(),
      lat: num(r[5]),
      lng: num(r[6]),
    });
  }
  return { routes, stops, skippedNotes };
}

/** The places sheet (the friend's copy of our places template): the first row has the field names, the second their Japanese labels. */
export function parseFacilities(text: string): FacilityRow[] {
  const [head, , ...rows] = parseCsv(text);
  if (!head) return [];
  const at = (name: string) => head.indexOf(name);
  const [cName, cEn, cCat, cLat, cLng, cSrc] = ["name_ja", "name_en", "category", "lat", "lng", "coord_source"].map(at);
  // The course number and the nearby stop have no field names in the template's first row: they are columns 6 and 7.
  const cRoute = at("ｚ") >= 0 ? at("ｚ") : 5;
  return rows.flatMap((r) => {
    const nameJa = (r[cName!] ?? "").trim();
    const route = num(r[cRoute]);
    if (!nameJa || route === null) return [];
    return [
      {
        route,
        near: (r[cRoute + 1] ?? "").trim(),
        categoryJa: (r[cCat!] ?? "").trim(),
        nameJa,
        nameEn: (r[cEn!] ?? "").trim() || null,
        lat: num(r[cLat!]),
        lng: num(r[cLng!]),
        coordSource: (r[cSrc!] ?? "").trim(),
      },
    ];
  });
}

/** The points a person placed on a map as GeoJSON: only the named points (a search result has a label and no id). */
export function parseMoundPoints(json: string): MoundPoint[] {
  const data = JSON.parse(json) as { features?: { id?: unknown; geometry?: { type?: string; coordinates?: number[] } }[] };
  return (data.features ?? []).flatMap((f) => {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    return f.geometry?.type === "Point" && typeof f.id === "string" && typeof lat === "number" && typeof lng === "number" ? [{ name: f.id, lat, lng }] : [];
  });
}

/** The waypoint kind for a stop, from its name and the sheet's place type. */
export function kindOfStop(s: Pick<StopRow, "nameJa" | "placeType">): SpotKindName {
  if (s.nameJa.includes("経塚")) return "mound";
  const p = s.placeType.replace(/（.*）$/, "");
  if (p === "駅") return "station";
  if (p === "展望台" || p === "山" || p === "跡") return "view";
  if (p === "行") return "temple";
  return "other";
}

/** The kinds the app has for the places along a course; the others (shops, cafes ...) wait for the places directory. */
const FACILITY_KINDS: Record<string, SpotKindName> = { トイレ: "toilet", 自動販売機: "vending_machine", "休憩所・東屋": "rest_area" };

export interface Existing {
  id: string;
  route: number;
  nameJa: string;
  kind: SpotKindName;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
}
export interface PlannedSpot {
  route: number;
  nameJa: string;
  nameEn: string | null;
  kind: SpotKindName;
  stampable: boolean;
  lat: number | null;
  lng: number | null;
  source: string | null;
  /** The spot already in the database that this is (its mound, or a place loaded before). */
  existing?: Existing;
}
export interface Plan {
  spots: PlannedSpot[];
  /** Why rows were left out or changed, for the report. */
  notes: string[];
  /** Places not loaded because the app has no kind for them yet, by category. */
  waiting: Record<string, number>;
}

const SOURCE_STOP = "友人のシート（Navivi）の位置・未確認";
const SOURCE_MOUND = "地図に手で置いた点（GeoJSON）・未確認";
const near = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 1e-5;
/** The part after the middle dot: the sutra chapter, such as 序品. */
const chapterOf = (name: string) => name.split("・").pop() ?? name;

export function planLoad(input: { stops: StopRow[]; facilities: FacilityRow[]; mounds: MoundPoint[]; existing: Existing[] }): Plan {
  const notes: string[] = [];
  const waiting: Record<string, number> = {};
  const used = new Set<string>();
  const find = (route: number, pred: (e: Existing) => boolean) => input.existing.find((e) => e.route === route && !used.has(e.id) && pred(e));

  // A position shared by different places of one course was copied, not measured: leave it out.
  const sharers = new Map<string, Set<string>>();
  for (const s of input.stops) if (s.lat !== null && s.lng !== null) (sharers.get(`${s.route}|${s.lat}|${s.lng}`) ?? sharers.set(`${s.route}|${s.lat}|${s.lng}`, new Set()).get(`${s.route}|${s.lat}|${s.lng}`)!).add(s.nameJa);
  const copied = (s: StopRow) => (sharers.get(`${s.route}|${s.lat}|${s.lng}`)?.size ?? 0) > 1;

  const spots: PlannedSpot[] = [];
  const anchors = new Map<string, number>(); // `${route}|${label}` -> index in `spots` of the first stop with that label
  for (const s of input.stops) {
    if (s.type === "return") {
      notes.push(`${s.code} ${s.nameJa}: 復帰（戻り）の行は、同じ場所の繰り返しなので入れません`);
      continue;
    }
    const kind = kindOfStop(s);
    let lat = s.lat;
    let lng = s.lng;
    if (lat !== null && copied(s)) {
      notes.push(`${s.code} ${s.nameJa}: 同じ位置が別の場所にも書かれているため、位置は入れません`);
      lat = lng = null;
    }
    const planned: PlannedSpot = { route: s.route, nameJa: s.nameJa, nameEn: s.nameEn, kind, stampable: s.type === "stamp", lat, lng, source: lat === null ? null : SOURCE_STOP };
    if (kind === "mound") {
      // The mound is already in the database (seeded): keep it, with its stamp and its place in the rally.
      const mound = find(s.route, (e) => e.kind === "mound" && s.nameJa.includes(chapterOf(e.nameJa)));
      if (mound) {
        used.add(mound.id);
        planned.existing = mound;
        planned.nameJa = mound.nameJa;
        planned.stampable = true;
        planned.lat = mound.lat;
        planned.lng = mound.lng;
        planned.source = null;
      }
    } else {
      const again = find(s.route, (e) => e.kind === kind && e.nameJa === s.nameJa);
      if (again) {
        used.add(again.id);
        planned.existing = again;
      }
    }
    if (s.label && !anchors.has(`${s.route}|${s.label}`)) anchors.set(`${s.route}|${s.label}`, spots.length);
    spots.push(planned);
  }

  // The hand-placed mound points fill a mound that has no position yet (never replace one that has).
  for (const m of input.mounds) {
    const same = spots.filter((p) => p.existing?.kind === "mound").find((p) => p.existing!.nameJa === m.name);
    const all = input.existing.filter((e) => e.kind === "mound");
    const target = all.find((e) => e.nameJa === m.name) ?? (all.filter((e) => chapterOf(e.nameJa) === chapterOf(m.name)).length === 1 ? all.find((e) => chapterOf(e.nameJa) === chapterOf(m.name)) : undefined);
    if (!target) {
      notes.push(`${m.name}: 同じ名前の経塚が見つかりません（位置は入れません）`);
      continue;
    }
    if (target.lat !== null) continue;
    const inPlan = same ?? spots.find((p) => p.existing?.id === target.id);
    if (inPlan) Object.assign(inPlan, { lat: m.lat, lng: m.lng, source: SOURCE_MOUND });
    else spots.push({ route: target.route, nameJa: target.nameJa, nameEn: null, kind: "mound", stampable: true, lat: m.lat, lng: m.lng, source: SOURCE_MOUND, existing: target });
  }

  // Places along the course go right after the stop they are near.
  const after = new Map<number, PlannedSpot[]>();
  for (const f of input.facilities) {
    const kind = FACILITY_KINDS[f.categoryJa];
    if (!kind) {
      waiting[f.categoryJa] = (waiting[f.categoryJa] ?? 0) + 1;
      continue;
    }
    const at = anchors.get(`${f.route}|${f.near}`);
    if (at === undefined) {
      notes.push(`${f.nameJa}: 近くの場所「${f.near}」が見つからないため、${f.route} 番のコースの最後に入れます`);
    }
    const planned: PlannedSpot = {
      route: f.route,
      nameJa: f.nameJa,
      nameEn: f.nameEn,
      kind,
      stampable: false,
      lat: f.lat,
      lng: f.lng,
      source: f.lat === null ? null : `${f.coordSource || "地図アプリで確認"}（友人のシート）・未確認`,
    };
    const again = input.existing.find((e) => !used.has(e.id) && e.route === f.route && e.kind === kind && e.nameJa === f.nameJa && near(e.lat, f.lat) && near(e.lng, f.lng));
    if (again) {
      used.add(again.id);
      planned.existing = again;
    }
    const key = at ?? spots.length;
    after.set(key, [...(after.get(key) ?? []), planned]);
  }
  const ordered = spots.flatMap((p, i) => [p, ...(after.get(i) ?? [])]);
  const tail = after.get(spots.length);
  if (tail) ordered.push(...tail);
  return { spots: ordered, notes, waiting };
}

// Reads the CSV files Navivi exports for a route (`<n>_stops.csv`, `<n>_legs.csv`) into plain
// objects, the first step of loading real route content (WBS N-05). Pure functions, no I/O,
// so they are unit-tested. What comes out is a DRAFT: coordinates were placed on Navivi's map
// (not taken from an official source) and the narration is written by Navivi's AI, so a person
// must verify both before anything is published (see CLAUDE.md, "Spot coordinates are never guessed").

/** Parses CSV text (RFC 4180: quoted fields, doubled quotes, newlines inside quotes, optional BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

function records(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((cells) => Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ""])));
}

export interface NaviviStop {
  index: number;
  /** "S" start, "E" end, a number for a stop, "+1" for an optional stop-by. */
  label: string;
  nameJa: string;
  lat: number;
  lng: number;
  /** An optional visit on the way, not a leg endpoint. */
  isStopBy: boolean;
  /** Navivi's route mode ("draw" means a hand-drawn walking path). Not used for display. */
  routeMode: string;
  /** Written by Navivi's AI from the photos: a draft to review, not reviewed text. */
  attractionNarration: string;
}

export interface NaviviLeg {
  fromLabel: string;
  toLabel: string;
  mode: string;
  distanceM: number;
}

function num(value: string, what: string, row: number): number {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) throw new Error(`row ${row}: ${what} is not a number ("${value}")`);
  return n;
}

export function parseStops(csv: string): NaviviStop[] {
  return records(csv).map((r, i) => {
    const row = i + 2; // the header is row 1
    const lat = num(r.lat ?? "", "lat", row);
    const lng = num(r.lng ?? "", "lng", row);
    if (lat < -90 || lat > 90) throw new Error(`row ${row}: lat ${lat} is out of range`);
    if (lng < -180 || lng > 180) throw new Error(`row ${row}: lng ${lng} is out of range`);
    const name = (r.name ?? "").trim();
    if (!name) throw new Error(`row ${row}: the stop has no name`);
    return {
      index: num(r.index ?? "", "index", row),
      label: (r.label ?? "").trim(),
      nameJa: name,
      lat,
      lng,
      isStopBy: (r.is_stop_by ?? "").trim().toLowerCase() === "true",
      routeMode: (r.route_mode ?? "").trim(),
      attractionNarration: (r.attraction_narration ?? "").trim(),
    };
  });
}

export function parseLegs(csv: string): NaviviLeg[] {
  return records(csv).map((r, i) => ({
    fromLabel: (r.from_label ?? "").trim(),
    toLabel: (r.to_label ?? "").trim(),
    mode: (r.mode ?? "").trim(),
    distanceM: num(r.distance_m ?? "", "distance_m", i + 2),
  }));
}

/** Total length of the route in kilometres, one decimal, from the legs. */
export function totalDistanceKm(legs: readonly NaviviLeg[]): number {
  const metres = legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  return Math.round(metres / 100) / 10;
}

/**
 * A rough shape of the route from the stops alone, as points in a 0..1 box (x east, y south),
 * correcting longitude for latitude. It is straight lines between stops, not the walked path.
 */
export function stopsSketch(stops: readonly Pick<NaviviStop, "lat" | "lng">[]): [number, number][] {
  if (stops.length === 0) return [];
  const meanLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = stops.map((p) => p.lng * k);
  const ys = stops.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  return stops.map((_, i) => [round((xs[i]! - minX) / span), round((ys[i]! - minY) / span)]);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

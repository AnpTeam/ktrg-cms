import { pointIconSvg } from "./point-icons";

// How to get to a route, as a list of entries shown like the Start / Goal badges: a kind (train, bus ...), the place's name
// and a short note. The API holds the same list (apps/api/src/db/schema/content.ts, `accessTypes`). Pure, so the admin
// and the public pages share it.

export const accessTypes = ["train", "bus", "ferry", "car", "walk", "other"] as const;
export type AccessType = (typeof accessTypes)[number];

export interface AccessPoint {
  type: AccessType;
  nameJa: string;
  nameEn: string | null;
  noteJa: string | null;
  noteEn: string | null;
}

export const isAccessType = (v: unknown): v is AccessType => typeof v === "string" && (accessTypes as readonly string[]).includes(v);

/** A new empty row for the editor. */
export const newAccessPoint = (type: AccessType = "train"): AccessPoint => ({ type, nameJa: "", nameEn: null, noteJa: null, noteEn: null });

/** The most entries a route can have (the API refuses more). */
export const MAX_ACCESS_POINTS = 10;

/** The badge colour of each kind, fixed like the pin colours (white words on it). */
export const accessColor: Record<AccessType, string> = {
  train: "#1e50a2",
  bus: "#0f766e",
  ferry: "#0b6fa8",
  car: "#9a5b13",
  walk: "#14532d",
  other: "#5a4f4a",
};

/** The picture beside each kind: the map's own pictures for train, bus, ferry and parking, plus a walker; drawn on a white disc. */
export const accessIconSvg: Record<AccessType, string> = {
  train: pointIconSvg.station,
  bus: pointIconSvg.bus_stop,
  ferry: pointIconSvg.ferry,
  car: pointIconSvg.parking,
  walk:
    '<circle cx="14" cy="4.4" r="2.3" fill="#14532d"/><path d="M13 8.6l-1.6 5.2M12.6 9.8L9.4 12.4M13 9.6l3.2 3M11.4 13.8L8.6 20.6M11.4 13.8l3.2 3 .4 4.6" stroke="#14532d" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  other: pointIconSvg.other,
};

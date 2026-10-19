// What a route still needs before visitors get a good page. "Required" items are what makes the route usable;
// "recommended" items make it better. Each item points at the editor tab where it is fixed.

import type { AdminRouteSummary, Prefecture } from "./types";
import { stampPlaces, type RouteDraft } from "./route-draft";

export type EditorTab = "overview" | "text" | "map" | "places" | "check";

export type ChecklistId =
  | "name_ja"
  | "description_ja"
  | "line_checked"
  | "places_published"
  | "prefecture"
  | "english"
  | "history"
  | "access"
  | "photo"
  | "video";

export interface ChecklistItem {
  id: ChecklistId;
  required: boolean;
  done: boolean;
  tab: EditorTab;
}

/** The facts the checklist looks at; empty text counts as missing. */
export interface RouteFacts {
  nameJa: string | null;
  nameEn: string | null;
  descriptionJa: string | null;
  descriptionEn: string | null;
  historyJa: string | null;
  accessJa: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  prefecture: Prefecture | null;
  hasLine: boolean;
  lineVerified: boolean;
  publishedStampPlaces: number;
}

const filled = (s: string | null): boolean => s !== null && s.trim() !== "";

export function checklist(f: RouteFacts): ChecklistItem[] {
  return [
    { id: "name_ja", required: true, done: filled(f.nameJa), tab: "overview" },
    { id: "description_ja", required: true, done: filled(f.descriptionJa), tab: "text" },
    { id: "line_checked", required: true, done: f.hasLine && f.lineVerified, tab: "map" },
    { id: "places_published", required: true, done: f.publishedStampPlaces > 0, tab: "places" },
    { id: "prefecture", required: false, done: f.prefecture !== null, tab: "overview" },
    { id: "english", required: false, done: filled(f.nameEn) && filled(f.descriptionEn), tab: "text" },
    { id: "history", required: false, done: filled(f.historyJa), tab: "text" },
    { id: "access", required: false, done: filled(f.accessJa), tab: "text" },
    { id: "photo", required: false, done: filled(f.photoUrl), tab: "overview" },
    { id: "video", required: false, done: filled(f.videoUrl), tab: "overview" },
  ];
}

export function factsFromSummary(r: AdminRouteSummary): RouteFacts {
  return {
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    descriptionJa: r.descriptionJa,
    descriptionEn: r.descriptionEn,
    historyJa: r.historyJa,
    accessJa: r.accessJa,
    photoUrl: r.photoUrl,
    videoUrl: r.videoUrl,
    prefecture: r.prefecture,
    hasLine: r.geometry !== null && r.geometry.coordinates.length >= 2,
    lineVerified: r.lineVerified,
    publishedStampPlaces: r.publishedSpotCount,
  };
}

export function factsFromDraft(d: RouteDraft): RouteFacts {
  return {
    nameJa: d.nameJa,
    nameEn: d.nameEn,
    descriptionJa: d.descriptionJa,
    descriptionEn: d.descriptionEn,
    historyJa: d.historyJa,
    accessJa: d.accessJa,
    photoUrl: d.photoUrl,
    videoUrl: d.videoUrl,
    prefecture: d.prefecture,
    hasLine: d.line.length >= 2,
    lineVerified: d.lineVerified,
    publishedStampPlaces: stampPlaces(d).filter((p) => p.published).length,
  };
}

/** How many required and recommended items are done, and whether the route needs work (a required item is missing). */
export function progress(items: readonly ChecklistItem[]): { requiredDone: number; requiredTotal: number; recommendedDone: number; recommendedTotal: number; needsWork: boolean } {
  const req = items.filter((i) => i.required);
  const rec = items.filter((i) => !i.required);
  const requiredDone = req.filter((i) => i.done).length;
  return {
    requiredDone,
    requiredTotal: req.length,
    recommendedDone: rec.filter((i) => i.done).length,
    recommendedTotal: rec.length,
    needsWork: requiredDone < req.length,
  };
}

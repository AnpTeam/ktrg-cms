// The rules of the desktop journey (docs/landing-desktop-design.md): which screens get which scene, which photos stand in
// the picture panel, and whether the beats fit the stage. Pure: no React, no DOM, so they are unit-tested.
import { previewRoutes } from "./landing-story";

/** The scroll scene runs on any screen tall enough to hold a beat, when the visitor allows motion. */
export const SCENE_QUERY = "(prefers-reduced-motion: no-preference) and (min-height: 38rem)";
/** The desktop layout of the scene. Not the `wide` variant: that also matches a phone on its side, which must keep the stacked page. */
export const DESK_QUERY = "(min-width: 1024px) and (min-height: 38rem)";
/** How much scroll the scene is, in screen heights: a little longer on a desktop, where each beat has more to show. */
export const DESK_SCROLL_SVH = 300;
export const PHONE_SCROLL_SVH = 250;

/** What a beat needs under its words for the ridge to show at least in part (the stage reserves more, 13rem, but a short screen may squeeze it). */
export const RIDGE_ROOM_PX = 96;
/** On a phone the ridge lies under the words (its drawing, caption and padding are about this tall), so a beat must leave all of it. */
export const PHONE_RIDGE_ROOM_PX = 232;

export type PanelPhoto = { src: string; credit: string | null };

/**
 * The photos behind the picture panel: course photos (published courses first, in course order, no repeated picture), then
 * the first banner photo, then `fallback`, so there are always `count` photos and none is empty. The input is not changed.
 */
export function panelPhotos(
  routes: readonly { status: string; order: number; photoUrl: string | null; photoCredit?: string | null }[],
  banner: string | null,
  fallback: string,
  count = 2,
  /** An editor's own photo for a place (null: the app picks). */
  chosen: readonly (string | null)[] = [],
): PanelPhoto[] {
  const out: PanelPhoto[] = [];
  const add = (src: string | null | undefined, credit: string | null) => {
    if (src && out.length < count && !out.some((p) => p.src === src)) out.push({ src, credit });
  };
  for (const r of previewRoutes(routes, routes.length)) add(r.photoUrl, r.photoCredit ?? null);
  add(banner, null);
  add(fallback, null);
  while (out.length < count) out.push({ src: fallback, credit: null }); // the same fallback twice rather than an empty panel
  // The editor's photo takes its own place; the others are the app's picks in order.
  return Array.from({ length: count }, (_, i) => (chosen[i] ? { src: chosen[i]!, credit: null } : out.shift()!));
}

/** Whether every beat is no taller than the stage; false when a height or the stage is not a number. */
export function beatsFit(heights: readonly number[], stage: number): boolean {
  if (!Number.isFinite(stage)) return false;
  return heights.every((h) => Number.isFinite(h) && h <= stage);
}

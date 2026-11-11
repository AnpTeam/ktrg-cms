// Small pure rules of the landing story (docs/landing-story-design.md). No React, no DOM, so they are unit-tested.

/** How far through the range [top, bottom] a scroll position is, 0 to 1. An empty or backwards range is 0. */
export function progressOf(scrollY: number, top: number, bottom: number): number {
  if (!Number.isFinite(scrollY) || !(bottom > top)) return 0;
  return Math.min(1, Math.max(0, (scrollY - top) / (bottom - top)));
}

/**
 * The courses the home page shows: published ones first in course order, then, when fewer than `max` are published,
 * unpublished ones (準備中) in course order. The input is left as it is.
 */
export function previewRoutes<T extends { status: string; order: number }>(routes: readonly T[], max = 5): T[] {
  const soon = (r: T) => Number(r.status === "soon");
  return [...routes].sort((a, b) => soon(a) - soon(b) || a.order - b.order).slice(0, Math.max(0, max));
}

export const INSTALL_NUDGE_AFTER_SECONDS = 180;
export const INSTALL_NUDGE_QUIET_DAYS = 30;

/**
 * Whether the small "add to home screen" bar shows: on a phone that has not installed the app, from the second visit or
 * after three minutes, never on the map, inside another app's browser, over a dialog or while someone is typing, and not
 * for 30 days after it was dismissed.
 */
export function installNudgeShows(s: {
  phone: boolean;
  installed: boolean;
  inAppBrowser: boolean;
  onMap: boolean;
  visits: number;
  seconds: number;
  dismissedDaysAgo: number | null;
  dialogOpen: boolean;
  inputFocused: boolean;
}): boolean {
  if (!s.phone || s.installed || s.inAppBrowser || s.onMap || s.dialogOpen || s.inputFocused) return false;
  if (s.dismissedDaysAgo !== null && s.dismissedDaysAgo < INSTALL_NUDGE_QUIET_DAYS) return false;
  return s.visits >= 2 || s.seconds >= INSTALL_NUDGE_AFTER_SECONDS;
}

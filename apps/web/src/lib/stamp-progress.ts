// After a NEW stamp, a screen that knows how far the rally has come tells the popup (StampProgressPopup, in the layout),
// which shows the ring filling. The popup is only a celebration: the server already decided the stamp.
export const STAMP_PROGRESS_EVENT = "ktrg:stamp-progress";

export type StampProgress = { rallyName: string; before: number; after: number; total: number; place: string };

export const STAMP_POPUP_CLOSED_EVENT = "ktrg:stamp-popup-closed";
const POPUP = 'dialog[aria-labelledby="stamp-progress-title"][open]';
export const stampPopupOpen = () => document.querySelector(POPUP) !== null;

/**
 * The popups owed for waiting stamps the server has just taken: one per rally, the ring running from the count at the first press
 * to that plus the number taken. A stamp the server already had, or one pressed where no rally was known, adds none.
 */
export function progressFromAccepted(outcomes: readonly { kind: string; already?: boolean; row?: { celebrate?: { rallyName: string; before: number; total: number; place: string } } }[]): StampProgress[] {
  const byRally = new Map<string, StampProgress>();
  for (const o of outcomes) {
    const c = o.kind === "accepted" && !o.already ? o.row?.celebrate : undefined;
    if (!c) continue;
    const have = byRally.get(c.rallyName);
    byRally.set(c.rallyName, have ? { ...have, before: Math.min(have.before, c.before), after: Math.min(have.before, c.before) + (have.after - have.before) + 1, place: c.place } : { rallyName: c.rallyName, before: c.before, after: c.before + 1, total: c.total, place: c.place });
  }
  return [...byRally.values()];
}

export function announceProgress(detail: StampProgress) {
  window.dispatchEvent(new CustomEvent<StampProgress>(STAMP_PROGRESS_EVENT, { detail }));
}

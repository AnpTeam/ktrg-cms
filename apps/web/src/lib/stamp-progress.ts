// After a NEW stamp, a screen that knows how far the rally has come tells the popup (StampProgressPopup, in the layout),
// which shows the ring filling. The popup is only a celebration: the server already decided the stamp.
export const STAMP_PROGRESS_EVENT = "ktrg:stamp-progress";

export type StampProgress = { rallyName: string; before: number; after: number; total: number; place: string };

export const STAMP_POPUP_CLOSED_EVENT = "ktrg:stamp-popup-closed";
const POPUP = 'dialog[aria-labelledby="stamp-progress-title"][open]';
export const stampPopupOpen = () => document.querySelector(POPUP) !== null;

export function announceProgress(detail: StampProgress) {
  window.dispatchEvent(new CustomEvent<StampProgress>(STAMP_PROGRESS_EVENT, { detail }));
}

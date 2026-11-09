// The one message over the admin pages. It lives outside React so it stays on screen across a page change, and every form
// shares it. Good news closes itself; an error stays until it is closed, or until the page changes (see Toaster).

/** `leaving`: closed, and on screen only while it fades away. */
export type Toast = { id: number; kind: "ok" | "error"; text: string; action?: { label: string; run: () => void }; leaving?: boolean };

/** Long enough for an older reader to finish the longest message. */
export const TOAST_OK_MS = 8000;
/** The fade of a closing message (.toast-out in globals.css). */
export const TOAST_LEAVE_MS = 150;

let current: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function subscribeToast(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const readToast = () => current;

/** Show a message in place of the last one, or null to close it. */
export function showToast(next: Omit<Toast, "id" | "leaving"> | null) {
  clearTimeout(timer);
  if (next) {
    current = { ...next, id: nextId++ };
    if (next.kind === "ok") timer = setTimeout(() => showToast(null), TOAST_OK_MS);
  } else {
    if (!current || current.leaving) return;
    current = { ...current, leaving: true };
    timer = setTimeout(() => {
      current = null;
      notify();
    }, TOAST_LEAVE_MS);
  }
  notify();
}

const notify = () => listeners.forEach((listener) => listener());

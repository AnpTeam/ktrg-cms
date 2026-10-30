// The row of medals on a route card: one per stamp place. Pure, so it is unit-tested.

/**
 * How many medals to draw when only `capacity` fit on the line. Everything is shown when it fits; when it does not,
 * the last two spaces are taken by a "+n" mark (it is wider than a medal, and "+14" wider still), so two medals fewer than the capacity are drawn and `more` says how many are
 * hidden. At least one medal is always drawn when there are any.
 */
export function medalLayout(total: number, capacity: number): { shown: number; more: number } {
  if (total <= 0) return { shown: 0, more: 0 };
  const room = Math.max(1, Math.floor(capacity));
  if (total <= room) return { shown: total, more: 0 };
  const shown = Math.max(1, room - 2);
  return { shown, more: total - shown };
}

/** How many medals fit across `widthPx`, each `sizePx` wide with `gapPx` between them. */
export function medalCapacity(widthPx: number, sizePx: number, gapPx: number): number {
  if (widthPx <= 0) return 1;
  return Math.max(1, Math.floor((widthPx + gapPx) / (sizePx + gapPx)));
}

/** Which of the drawn medals are earned: the first `earned` ones (a medal row reads left to right, earned first). */
export function isEarned(index: number, earned: number | null): boolean {
  return earned !== null && index < earned;
}

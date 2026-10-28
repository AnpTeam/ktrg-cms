// Numbered pages for the lists: "page 2 of 12", prev / next, and a box to type a page into. Pure, so it is unit-tested.

export const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

/** The page a typed value means, kept within 1 to `pages`; null when it is not a number. */
export function clampPage(value: number | string, pages: number): number | null {
  const n = typeof value === "string" && value.trim() === "" ? Number.NaN : Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(1, n), pages) : null;
}

export const pageSlice = <T,>(items: readonly T[], page: number, size: number): T[] => items.slice((page - 1) * size, page * size);

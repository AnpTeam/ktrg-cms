import { cellOf, itemName, type FieldUi, type ListItem, type ListMeta } from "./config";

// Sorting the rows already on the page (a list is read 50 at a time, newest first; "もっと見る" adds more, and the sort
// keeps applying to them). Pure, so it is unit-tested (sort.test.ts). `key` is "name" or a column's field name.

export type Sort = { key: string; dir: "asc" | "desc" } | null;

/** The next click on a column header: ascending, then descending, then back to the list's own order. */
export function nextSort(now: Sort, key: string): Sort {
  if (now?.key !== key) return { key, dir: "asc" };
  return now.dir === "asc" ? { key, dir: "desc" } : null;
}

const DATE_KINDS = new Set<FieldUi["kind"]>(["date", "datetime"]);

/** What a row is ordered by in a column: the day or moment itself, a number as a number, otherwise the words as shown. */
function sortValue(f: FieldUi | null, meta: ListMeta, item: ListItem, locale: string, routeName: (id: string, field: string) => string | null): string | number | null {
  if (f === null) return itemName(meta, item, locale) || null;
  const raw = item[f.name];
  if (raw === null || raw === undefined || raw === "") return null;
  if (DATE_KINDS.has(f.kind) || f.kind === "number" || f.kind === "decimal") return typeof raw === "number" ? raw : String(raw);
  const text = cellOf(f, item, locale, routeName).text;
  return text === "" || text === "—" ? null : text;
}

/** A sorted copy; rows with nothing in the column go last either way, and equal rows keep the list's own order. */
export function sortItems(items: ListItem[], meta: ListMeta, sort: Sort, locale: string, routeName: (id: string, field: string) => string | null): ListItem[] {
  if (sort === null) return items;
  const f = sort.key === "name" ? null : (meta.fields.find((x) => x.name === sort.key) ?? null);
  const collator = new Intl.Collator(locale === "en" ? "en" : "ja", { numeric: true });
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, v: sortValue(f, meta, item, locale, routeName) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.index - b.index : a.v === null ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : collator.compare(String(a.v), String(b.v));
      return c !== 0 ? c * sign : a.index - b.index;
    })
    .map((x) => x.item);
}

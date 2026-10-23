import type { FieldUi, ListRow } from "./list-types";

// Searching and filtering any list, for every list at once: the rows are read page by page and kept when they match,
// so no table needs its own query. Only for rows the admin may already read.

/** `q`: words to find in any text field (either language). `eq`: a field that must equal a value ("true" / "false" for a tick box). */
export interface ListFilter {
  q?: string;
  eq?: Record<string, string>;
}

const norm = (v: unknown) => String(v ?? "").normalize("NFKC").toLowerCase(); // full and half width match each other

export const isFiltering = (f: ListFilter | undefined): f is ListFilter => !!f && (!!f.q || Object.keys(f.eq ?? {}).length > 0);

/** A field the row does not have never matches: a typo in a filter gives an empty list, not everything. */
export function rowMatches(row: Record<string, unknown>, fields: readonly FieldUi[], f: ListFilter): boolean {
  for (const [name, want] of Object.entries(f.eq ?? {})) {
    if (!fields.some((x) => x.name === name) || String(row[name] ?? "") !== want) return false;
  }
  if (!f.q) return true;
  const needle = norm(f.q);
  return fields.some((x) =>
    x.kind === "bilingual" || x.kind === "bilingual-long"
      ? [`${x.name}Ja`, `${x.name}En`].some((k) => norm(row[k]).includes(needle))
      : (x.kind === "text" || x.kind === "url") && norm(row[x.name]).includes(needle),
  );
}

/** "name:value" texts from the query string (a lone one or several) as a filter's `eq`; text without a name is dropped. */
export function eqFromQuery(filter: string | string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const text of [filter ?? []].flat()) {
    const at = text.indexOf(":");
    const name = text.slice(0, at);
    if (at > 0 && /^\w+$/.test(name)) out[name] = text.slice(at + 1);
  }
  return out;
}

// shortcut: a filtered page reads at most this many rows before it stops (and offers "more"), so a huge table is never
// walked in one request; when a list grows past a few thousand rows, filter in SQL instead.
export const MAX_SCAN = 5000;
export const SCAN_BATCH = 200;


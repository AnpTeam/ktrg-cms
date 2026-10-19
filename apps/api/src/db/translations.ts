// The words of a route, place or rally live in a *_translations table, one row per language. The rest of
// the API sees them flat (nameJa, nameEn ...): these turn rows into that shape and back.
import type { Locale } from "../auth/user";

const LOCALES = ["ja", "en"] as const satisfies readonly Locale[];
const SUFFIX = { ja: "Ja", en: "En" } as const;

/** `name` → `{ nameJa, nameEn }`. */
export type Flat<F extends string> = { [K in F as `${K}Ja` | `${K}En`]: string | null };

type TextRow<F extends string> = { locale: Locale } & { [K in F]: string | null };

/** Words to write: one entry per language, with only the fields that change. */
export type Texts<F extends string> = { locale: Locale; values: Partial<Record<F, string | null>> }[];

/** Which text fields each owner has. */
export const ROUTE_TEXT = ["name", "description", "history", "access"] as const;
export const SPOT_TEXT = ["name", "description", "statusNote"] as const;
export const RALLY_TEXT = ["name"] as const;

/** Every field null: an owner with no translation rows. */
export function emptyTexts<F extends string>(fields: readonly F[]): Flat<F> {
  const out: Record<string, null> = {};
  for (const f of fields) for (const l of LOCALES) out[f + SUFFIX[l]] = null;
  return out as Flat<F>;
}

/** Translation rows grouped by owner id, each flattened. */
export function flattenTexts<F extends string, R extends TextRow<F>>(
  fields: readonly F[],
  rows: readonly R[],
  ownerOf: (row: R) => string,
): Map<string, Flat<F>> {
  const out = new Map<string, Flat<F>>();
  for (const row of rows) {
    const id = ownerOf(row);
    const flat = (out.get(id) ?? emptyTexts(fields)) as Record<string, string | null>;
    for (const f of fields) flat[f + SUFFIX[row.locale]] = row[f];
    out.set(id, flat as Flat<F>);
  }
  return out;
}

/**
 * Splits flat values into the owner's own columns and one set of words per language that has any.
 * Undefined means "not changed" and is left out, as Drizzle would.
 */
export function splitTexts<F extends string, T extends object>(fields: readonly F[], values: T) {
  const rest: Record<string, unknown> = { ...(values as Record<string, unknown>) };
  const texts: Texts<F> = [];
  for (const locale of LOCALES) {
    const words: Partial<Record<F, string | null>> = {};
    for (const f of fields) {
      const key = f + SUFFIX[locale];
      if (rest[key] !== undefined) words[f] = rest[key] as string | null;
      delete rest[key];
    }
    if (Object.keys(words).length > 0) texts.push({ locale, values: words });
  }
  return { rest: rest as Omit<T, keyof Flat<F>>, texts };
}

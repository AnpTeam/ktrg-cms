import type { FieldUi, Label, ListMeta } from "@ktrg/api"; // type only: nothing from the API is bundled
import { formatDay } from "@/lib/format";

// The web half of the generic admin list (the API half is apps/api/src/admin-lists). The web app has no code per
// table: GET /admin/lists says what each list looks like (labels in both languages, field kinds, the facts shown
// in the list), and AdminNav, AdminListTable and AdminItemForm draw every list from that.

export type { FieldUi, Label, ListMeta };

/** A row as the API sends it: its flat fields (`titleJa`, `titleEn`, ...) plus id and times. */
export type ListItem = { id: string; createdAt: string; updatedAt: string } & Record<string, unknown>;

/** An admin label in the page's language (English falls back to Japanese). */
export const pick = (label: Label, locale: string): string => (locale === "en" && label.en ? label.en : label.ja);

/** What names a row in the list: its title field (bilingual or text), in the page's language. */
export function itemName(meta: ListMeta, item: ListItem, locale: string): string {
  if (`${meta.titleField}Ja` in item) {
    const ja = String(item[`${meta.titleField}Ja`] ?? "");
    const en = item[`${meta.titleField}En`];
    return locale === "en" && typeof en === "string" && en ? en : ja;
  }
  return String(item[meta.titleField] ?? "");
}

/** Where a row leads: its own form, the page named by `linkTo`, or nowhere (a read-only list). */
export function itemHref(meta: ListMeta, item: ListItem, locale: string): string | null {
  if (meta.linkTo) return `/${locale}/admin/${meta.linkTo.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(item[name] ?? "")))}`;
  return meta.ops.edit ? `/${locale}/admin/${meta.key}/${item.id}` : null;
}

/** A moment in Japan time, as the admin reads it. */
export function formatMoment(locale: string, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** One field's value as text (null when it has none): a day or moment written out, a route by name, a choice by label. */
export function displayValue(f: FieldUi, item: ListItem, locale: string, routeName: (id: string) => string | null): string | null {
  if (f.kind === "bilingual" || f.kind === "bilingual-long") return itemName({ titleField: f.name } as ListMeta, item, locale) || null;
  const value = item[f.name];
  if (value === null || value === undefined || value === "") return null;
  switch (f.kind) {
    case "date":
      return formatDay(locale, String(value));
    case "datetime":
      return formatMoment(locale, String(value));
    case "route":
      return routeName(String(value));
    case "select": {
      const option = f.options?.find((o) => o.value === value);
      return option ? pick(option.label, locale) : String(value);
    }
    default:
      return String(value);
  }
}

/** The short facts under a row's name, from the fields marked `inList`, in field order. */
export function itemFacts(meta: ListMeta, item: ListItem, locale: string, routeName: (id: string) => string | null): string[] {
  return meta.fields.flatMap((f) => {
    const show = f.inList;
    if (!show) return [];
    if (f.kind === "boolean") {
      const label = item[f.name] === true ? show.yes : show.no;
      return label ? [pick(label, locale)] : [];
    }
    const text = displayValue(f, item, locale, routeName);
    if (text === null) return show.empty ? [pick(show.empty, locale)] : [];
    return [show.text ? pick(show.text, locale).replace("{value}", text) : text];
  });
}

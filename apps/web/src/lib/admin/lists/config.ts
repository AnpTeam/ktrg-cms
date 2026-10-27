import type { FieldUi, Label, ListMeta, Tone } from "@ktrg/api"; // type only: nothing from the API is bundled
import { formatDay } from "@/lib/format";

// The web half of the generic admin list (the API half is apps/api/src/admin-lists). The web app has no code per
// table: GET /admin/lists says what each list looks like (labels in both languages, field kinds, the facts shown
// in the list), and AdminNav, AdminListTable and AdminItemForm draw every list from that.

export type { FieldUi, Label, ListMeta, Tone };

/** A row as the API sends it: its flat fields (`titleJa`, `titleEn`, ...) plus id and times. */
export type ListItem = { id: string; createdAt: string; updatedAt: string } & Record<string, unknown>;

/** An admin label in the page's language (English falls back to Japanese). */
export const pick = (label: Label, locale: string): string => (locale === "en" && label.en ? label.en : label.ja);

/** What names a row in the list: its title field (bilingual or text), in the page's language. */
export function itemName(meta: ListMeta, item: ListItem, locale: string): string {
  // A list can name its rows by the first of several fields that has a value (a member: name, else email, else ID).
  for (const field of meta.titleFrom ?? []) {
    const v = item[field];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  if (`${meta.titleField}Ja` in item) {
    const ja = String(item[`${meta.titleField}Ja`] ?? "");
    const en = item[`${meta.titleField}En`];
    return locale === "en" && typeof en === "string" && en ? en : ja;
  }
  return String(item[meta.titleField] ?? "");
}

/** Where a row leads: its own form, the page named by `linkTo`, or nowhere (a read-only list). */
export function itemHref(meta: ListMeta, item: ListItem): string | null {
  if (meta.linkTo) return `/admin/${meta.linkTo.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(item[name] ?? "")))}`;
  return meta.ops.edit ? `/admin/${meta.key}/${item.id}` : null;
}

/** A moment in Japan time, as the admin reads it. */
export function formatMoment(locale: string, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** One field's value as text (null when it has none): a day or moment written out, a route by name, a choice by label. */
export function displayValue(f: FieldUi, item: ListItem, locale: string, routeName: (id: string, field: string) => string | null): string | null {
  if (f.kind === "bilingual" || f.kind === "bilingual-long") return itemName({ titleField: f.name } as ListMeta, item, locale) || null;
  const value = item[f.name];
  if (value === null || value === undefined || value === "") return null;
  switch (f.kind) {
    case "date":
      return formatDay(locale, String(value));
    case "datetime":
      return formatMoment(locale, String(value));
    case "hours":
      return "…";
    case "route":
    case "relation":
      return routeName(String(value), f.name);
    case "select": {
      const option = f.options?.find((o) => o.value === value);
      return option ? pick(option.label, locale) : String(value);
    }
    default:
      return String(value);
  }
}

/** The short facts under a row's name, from the fields marked `inList`, in field order. */
export function itemFacts(meta: ListMeta, item: ListItem, locale: string, routeName: (id: string, field: string) => string | null): string[] {
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

/** How many rows of another list a relation field offers to pick from (the page loads that many; the picker says so when it is reached). */
export const MAX_RELATION_CHOICES = 500;

/** True when the row's name came from `titleFrom`, so its own title field (the member ID) is worth showing small beneath it. */
export const nameIsFallback = (meta: ListMeta, item: ListItem): boolean => (meta.titleFrom ?? []).some((f) => typeof item[f] === "string" && String(item[f]).trim() !== "");

/** The list's columns: the fields marked `inList`, in order, except the ones that make up the row's name. */
export function listColumns(meta: ListMeta): FieldUi[] {
  const naming = new Set([meta.titleField, ...(meta.titleFrom ?? [])]);
  return meta.fields.filter((f) => f.inList && !naming.has(f.name));
}

/** What one cell shows: a chip (a choice or a yes/no) with its tone, or plain text; `text` is "" for nothing to show. */
export interface Cell {
  text: string;
  chip: boolean;
  tone: Tone;
}

export function cellOf(f: FieldUi, item: ListItem, locale: string, routeName: (id: string, field: string) => string | null): Cell {
  const show = f.inList ?? {};
  if (f.kind === "boolean") {
    const yes = item[f.name] === true;
    const label = yes ? show.yes : show.no;
    return { text: label ? pick(label, locale) : "", chip: true, tone: show.tone?.[yes ? "yes" : "no"] ?? (yes ? "good" : "neutral") };
  }
  if (f.kind === "select") {
    const value = item[f.name];
    const option = f.options?.find((o) => o.value === value);
    if (option) return { text: pick(option.label, locale), chip: true, tone: option.tone ?? "neutral" };
  }
  const text = displayValue(f, item, locale, routeName);
  return { text: text ?? (show.empty ? pick(show.empty, locale) : "—"), chip: false, tone: "neutral" };
}

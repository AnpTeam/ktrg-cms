import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { eqFromQuery, rowMatches } from "./list-filter";
import { createListReader } from "./list-service";
import { createMemoryListStore } from "./list-memory-store";
import type { FieldUi } from "./list-types";

const fields: FieldUi[] = [
  { name: "title", kind: "bilingual", label: { ja: "題", en: "Title" } },
  { name: "kind", kind: "select", label: { ja: "種類", en: "Kind" } },
  { name: "shown", kind: "boolean", label: { ja: "表示", en: "Shown" } },
  { name: "link", kind: "url", label: { ja: "リンク", en: "Link" } },
];

describe("rowMatches", () => {
  const row = { titleJa: "友ヶ島の船", titleEn: "Ferry", kind: "notice", shown: true, link: "https://example.com/Boat" };
  test("search finds text in either language, ignoring case and full-width letters", () => {
    expect(rowMatches(row, fields, { q: "ferry" })).toBe(true);
    expect(rowMatches(row, fields, { q: "ＦＥＲＲＹ" })).toBe(true);
    expect(rowMatches(row, fields, { q: "友ヶ島" })).toBe(true);
    expect(rowMatches(row, fields, { q: "boat" })).toBe(true);
    expect(rowMatches(row, fields, { q: "train" })).toBe(false);
  });
  test("a filter must equal the field; a field the list does not have matches nothing", () => {
    expect(rowMatches(row, fields, { eq: { kind: "notice", shown: "true" } })).toBe(true);
    expect(rowMatches(row, fields, { eq: { shown: "false" } })).toBe(false);
    expect(rowMatches(row, fields, { eq: { nope: "x" } })).toBe(false);
  });
});

test("eqFromQuery reads name:value texts, keeping colons inside the value", () => {
  expect(eqFromQuery(["kind:notice", "link:https://x.test", "bad", ":x", "a b:c"])).toEqual({ kind: "notice", link: "https://x.test" });
  expect(eqFromQuery("shown:true")).toEqual({ shown: "true" });
  expect(eqFromQuery(undefined)).toEqual({});
});

describe("a filtered page", () => {
  const audit = createMemoryAuditWriter();
  const actions = { create: "banner.create", update: "banner.update", delete: "banner.delete" } as never;
  test("keeps reading pages until it has enough matches, and offers the rest with a cursor", async () => {
    const mem = createMemoryListStore<{ titleJa: string; kind: string }>(audit.writer, actions);
    for (let i = 0; i < 12; i++) await mem.store.create("11111111-1111-4111-8111-111111111111", { titleJa: `row ${i}`, kind: i % 3 === 0 ? "a" : "b" });
    const reader = createListReader({ store: mem.store, pageSize: 3 });
    const narrow = { filter: { eq: { kind: "a" } }, fields: [{ name: "kind", kind: "select", label: { ja: "", en: "" } } as FieldUi] };
    const first = await reader.list(undefined, narrow);
    expect(first.items).toHaveLength(3);
    expect(first.items.every((r) => (r as unknown as { kind: string }).kind === "a")).toBe(true);
    expect(first.next).not.toBeNull();
    const second = await reader.list(first.next!, narrow);
    expect(second.items).toHaveLength(1); // 4 rows in all are "a"
    expect(second.next).toBeNull();
    expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(4);
  });
});

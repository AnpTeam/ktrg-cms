import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { eqFromQuery, rowMatches } from "./list-filter";
import { createListReader, createListService } from "./list-service";
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

describe("the after-save hook", () => {
  const actor = "11111111-1111-4111-8111-111111111111";
  const actions = { create: "banner.create", update: "banner.update", delete: "banner.delete" } as never;
  const rules = async (f: { titleJa?: string }) => ({ ok: true as const, value: f });
  const setup = (afterWrite: (e: unknown) => void | Promise<void>, log: (m: string) => void = () => {}) => {
    const mem = createMemoryListStore<{ titleJa: string }>(createMemoryAuditWriter().writer, actions);
    return createListService({ store: mem.store, rules, afterWrite: afterWrite as never, log });
  };

  test("is told about each saved create, update and delete, once, with the row", async () => {
    const seen: unknown[] = [];
    const svc = setup((e) => void seen.push(e));
    const made = (await svc.create(actor, { titleJa: "a" })) as { ok: true; value: { id: string; updatedAt: Date } };
    const changed = (await svc.update(actor, made.value.id, made.value.updatedAt, { titleJa: "b" })) as { ok: boolean };
    await svc.remove(actor, made.value.id);
    expect(changed.ok).toBe(true);
    expect(seen.map((e) => (e as { type: string }).type)).toEqual(["create", "update", "delete"]);
    expect((seen[1] as { row: { titleJa: string } }).row.titleJa).toBe("b");
    expect((seen[2] as { row: unknown }).row).toBeNull();
  });

  test("a hook that throws is logged and the save stands; a refused or conflicting change does not call it", async () => {
    const logged: string[] = [];
    let calls = 0;
    const svc = setup(() => {
      calls++;
      throw new Error("cache is down");
    }, (m) => logged.push(m));
    const made = (await svc.create(actor, { titleJa: "a" })) as { ok: true; value: { id: string; updatedAt: Date } };
    expect(made.ok).toBe(true);
    expect(logged).toEqual(["list hook after create failed: cache is down"]);
    const stale = await svc.update(actor, made.value.id, new Date(0), { titleJa: "b" });
    expect(stale.ok).toBe(false);
    expect((await svc.remove(actor, "99999999-9999-4999-8999-999999999999")).ok).toBe(false);
    expect(calls).toBe(1);
  });
});

describe("relation fields are checked by the service", () => {
  const actor = "11111111-1111-4111-8111-111111111111";
  const actions = { create: "banner.create", update: "banner.update", delete: "banner.delete" } as never;
  const rules = async (f: { titleJa?: string; guideId?: string | null }) => ({ ok: true as const, value: f });
  const known = new Set(["g1"]);
  const setup = () => {
    const mem = createMemoryListStore<{ titleJa: string; guideId: string | null }>(createMemoryAuditWriter().writer, actions);
    return createListService({ store: mem.store, rules: rules as never, relations: { guideId: async (id) => known.has(id) } });
  };

  test("a row pointing at a row that does not exist is refused; none (null) and a real one are saved", async () => {
    const svc = setup();
    expect((await svc.create(actor, { titleJa: "a", guideId: "gone" })).ok).toBe(false);
    expect((await svc.create(actor, { titleJa: "a", guideId: null })).ok).toBe(true);
    expect((await svc.create(actor, { titleJa: "a", guideId: "g1" })).ok).toBe(true);
  });

  test("on a change only the values being saved are looked at: an old dangling id does not block other edits", async () => {
    const svc = setup();
    const made = (await svc.create(actor, { titleJa: "a", guideId: "g1" })) as { ok: true; value: { id: string; updatedAt: Date } };
    known.delete("g1"); // the row it pointed at has since gone
    const rename = (await svc.update(actor, made.value.id, made.value.updatedAt, { titleJa: "b" })) as { ok: boolean; value?: { updatedAt: Date } };
    expect(rename.ok).toBe(true);
    const again = await svc.update(actor, made.value.id, rename.value!.updatedAt, { guideId: "g1" });
    expect(again.ok).toBe(false);
    known.add("g1");
  });
});

import { describe, expect, test } from "bun:test";
import type { ListItem, ListMeta } from "./config";
import { nextSort, sortItems } from "./sort";

const meta = {
  key: "users",
  titleField: "publicId",
  titleFrom: ["displayName"],
  fields: [
    { name: "publicId", kind: "text", label: { ja: "番号", en: "ID" } },
    { name: "displayName", kind: "text", label: { ja: "名前", en: "Name" } },
    { name: "role", kind: "select", label: { ja: "権限", en: "Permission" }, options: [{ value: "a", label: { ja: "管理者", en: "Admin" } }, { value: "p", label: { ja: "参加者", en: "Participant" } }], inList: {} },
    { name: "createdAt", kind: "datetime", label: { ja: "登録", en: "Registered" }, inList: {} },
  ],
} as unknown as ListMeta;
const row = (id: string, over: Record<string, unknown>): ListItem => ({ id, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "", publicId: `0${id}`, displayName: null, role: "p", ...over });
const items = [row("1", { displayName: "b", createdAt: "2026-10-03T00:00:00.000Z" }), row("2", { displayName: "a", role: "a" }), row("3", { displayName: null, role: null }), row("4", { displayName: "c", createdAt: "2026-10-02T00:00:00.000Z" })];
const ids = (rows: ListItem[]) => rows.map((r) => r.id);
const none = () => null;

describe("sorting a list's rows", () => {
  test("a header click goes ascending, descending, then back to the list's order", () => {
    expect(nextSort(null, "role")).toEqual({ key: "role", dir: "asc" });
    expect(nextSort({ key: "role", dir: "asc" }, "role")).toEqual({ key: "role", dir: "desc" });
    expect(nextSort({ key: "role", dir: "desc" }, "role")).toBeNull();
    expect(nextSort({ key: "role", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });

  test("by name (the name falls back to the ID), either way", () => {
    expect(ids(sortItems(items, meta, { key: "name", dir: "asc" }, "ja", none))).toEqual(["3", "2", "1", "4"]);
    expect(ids(sortItems(items, meta, { key: "name", dir: "desc" }, "ja", none))).toEqual(["4", "1", "2", "3"]);
  });

  test("by date, by the moment itself; a row with nothing in the column goes last either way", () => {
    expect(ids(sortItems(items, meta, { key: "createdAt", dir: "asc" }, "ja", none))).toEqual(["2", "3", "4", "1"]);
    expect(ids(sortItems(items, meta, { key: "role", dir: "asc" }, "ja", none)).at(-1)).toBe("3");
    expect(ids(sortItems(items, meta, { key: "role", dir: "desc" }, "ja", none)).at(-1)).toBe("3");
  });

  test("no sort leaves the list as it is, and the input is never changed", () => {
    expect(sortItems(items, meta, null, "ja", none)).toBe(items);
    sortItems(items, meta, { key: "name", dir: "asc" }, "ja", none);
    expect(ids(items)).toEqual(["1", "2", "3", "4"]);
  });
});

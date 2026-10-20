import { describe, expect, test } from "bun:test";
import { itemFacts, itemHref, itemName, type ListMeta } from "./config";
import { changedFields, formValues, missingRequired, toPayload } from "./form";

// The notices list as GET /admin/lists describes it (labels shortened).
const l = (ja: string) => ({ ja, en: ja });
const noticesList: ListMeta = {
  key: "notices",
  ops: { create: true, edit: true, delete: true },
  title: l("t"),
  intro: l("i"),
  newLabel: l("n"),
  deleteWarning: l("k"),
  titleField: "title",
  fields: [
    { name: "title", kind: "bilingual", label: l("a"), required: true },
    { name: "body", kind: "bilingual-long", label: l("b"), required: true },
    { name: "routeId", kind: "route", label: l("c"), inList: { empty: l("全体") } },
    { name: "sourceUrl", kind: "url", label: l("d"), required: true },
    { name: "sourceName", kind: "bilingual", label: l("f"), required: true },
    { name: "verifiedOn", kind: "date", label: l("g"), required: true, inList: { text: l("{value} に確認") } },
    { name: "expiresOn", kind: "date", label: l("h"), optional: true, inList: { text: l("{value} まで"), empty: l("期限なし") } },
    { name: "published", kind: "boolean", label: l("j"), inList: { yes: l("公開中"), no: l("下書き") } },
  ],
};

const saved = {
  id: "n1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  titleJa: "通行止め",
  titleEn: null,
  bodyJa: "本文",
  bodyEn: "Text",
  routeId: null,
  sourceUrl: "https://example.com/",
  sourceNameJa: "奈良県",
  sourceNameEn: null,
  verifiedOn: "2026-10-20",
  expiresOn: null,
  published: false,
};

describe("the generic admin form", () => {
  test("an empty form: blank text, not public, every required field missing", () => {
    const v = formValues(noticesList, null);
    expect(v.titleJa).toBe("");
    expect(v.published).toBe(false);
    expect(missingRequired(noticesList, v)).toEqual(["title", "body", "sourceUrl", "sourceName", "verifiedOn"]);
  });

  test("sends trimmed text, null for an empty English, link, day or route, and every field", () => {
    const v = { ...formValues(noticesList, null), titleJa: "  見出し ", titleEn: "  ", expiresOn: "", routeId: "", published: true };
    const p = toPayload(noticesList, v);
    expect(p).toMatchObject({ titleJa: "見出し", titleEn: null, expiresOn: null, routeId: null, published: true });
    expect(Object.keys(p).sort()).toEqual(
      ["bodyEn", "bodyJa", "expiresOn", "published", "routeId", "sourceNameEn", "sourceNameJa", "sourceUrl", "titleEn", "titleJa", "verifiedOn"],
    );
  });

  test("a change sends only what differs from the saved row", () => {
    const v = { ...formValues(noticesList, saved), titleEn: "Closed", expiresOn: "2026-10-31" };
    expect(changedFields(noticesList, v, saved)).toEqual({ titleEn: "Closed", expiresOn: "2026-10-31" });
    expect(changedFields(noticesList, formValues(noticesList, saved), saved)).toEqual({});
  });

  test("the facts under a row's name: a route by name or the empty text, days written out, yes / no for a tick", () => {
    const facts = itemFacts(noticesList, { ...saved, routeId: "r1", expiresOn: null, published: true }, "ja", (id) => (id === "r1" ? "コース2" : null));
    expect(facts).toEqual(["コース2", "2026年10月20日 に確認", "期限なし", "公開中"]);
    expect(itemFacts(noticesList, saved, "ja", () => null)).toEqual(["全体", "2026年10月20日 に確認", "期限なし", "下書き"]);
  });

  test("read-only fields are shown, never sent; numbers go out as numbers; a select starts on its first choice", () => {
    const users: ListMeta = {
      ...noticesList,
      key: "users",
      titleField: "publicId",
      fields: [
        { name: "publicId", kind: "text", label: l("id"), readOnly: true },
        { name: "role", kind: "select", label: l("r"), options: [{ value: "participant", label: l("参加者") }, { value: "admin", label: l("管理者") }], inList: {} },
        { name: "order", kind: "number", label: l("o") },
      ],
    };
    expect(formValues(users, null)).toEqual({ role: "participant", order: "" });
    expect(toPayload(users, { role: "admin", order: "3" })).toEqual({ role: "admin", order: 3 });
    const row = { id: "u1", createdAt: "x", updatedAt: "x", publicId: "12345678", role: "admin", order: 3 };
    expect(itemName(users, row, "ja")).toBe("12345678");
    expect(itemFacts(users, row, "ja", () => null)).toEqual(["管理者"]);
  });

  test("a row opens its own form, the page its list names, or nothing for a read-only list", () => {
    const row = { id: "p1", createdAt: "x", updatedAt: "x", routeId: "r 1" };
    expect(itemHref(noticesList, row)).toBe("/admin/notices/p1");
    expect(itemHref({ ...noticesList, linkTo: "routes/{routeId}" }, row)).toBe("/admin/routes/r%201");
    expect(itemHref({ ...noticesList, ops: { create: false, edit: false, delete: false } }, row)).toBeNull();
  });
});

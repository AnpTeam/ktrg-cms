import { describe, expect, test } from "bun:test";
import { cellOf, itemName, listColumns, nameIsFallback, type FieldUi, type ListItem, type ListMeta } from "./config";

const role: FieldUi = { name: "role", kind: "select", label: { ja: "権限", en: "Permission" }, options: [{ value: "participant", label: { ja: "参加者", en: "Participant" } }, { value: "admin", label: { ja: "管理者", en: "Administrator" }, tone: "info" }], inList: {} };
const users = {
  key: "users",
  titleField: "publicId",
  titleFrom: ["displayName", "email"],
  fields: [
    { name: "publicId", kind: "text", label: { ja: "会員番号", en: "Member ID" } },
    { name: "email", kind: "text", label: { ja: "メール", en: "Email" } },
    { name: "displayName", kind: "text", label: { ja: "名前", en: "Name" } },
    role,
    { name: "origin", kind: "select", label: { ja: "お住まい", en: "Where from" }, options: [{ value: "osaka", label: { ja: "大阪府", en: "Osaka" } }], inList: { empty: { ja: "未回答", en: "Not answered" } } },
  ],
} as unknown as ListMeta;
const row = (over: Record<string, unknown> = {}): ListItem => ({ id: "1", createdAt: "", updatedAt: "", publicId: "00012345", email: null, displayName: null, role: "participant", origin: null, ...over });
const none = () => null;

describe("list columns", () => {
  test("a member is named by name, else email, else member ID; the ID is shown small when it is not the name", () => {
    expect(itemName(users, row({ displayName: "hibi", email: "h@example.com" }), "ja")).toBe("hibi");
    expect(itemName(users, row({ email: "h@example.com" }), "ja")).toBe("h@example.com");
    expect(itemName(users, row(), "ja")).toBe("00012345");
    expect(nameIsFallback(users, row({ email: "h@example.com" }))).toBe(true);
    expect(nameIsFallback(users, row())).toBe(false);
  });

  test("the columns are the inList fields, without the ones that make up the name", () => {
    expect(listColumns(users).map((f) => f.name)).toEqual(["role", "origin"]);
  });

  test("a choice is a chip with its tone; an unanswered one says so in words", () => {
    expect(cellOf(role, row({ role: "admin" }), "ja", none)).toEqual({ text: "管理者", chip: true, tone: "info" });
    expect(cellOf(role, row(), "en", none)).toEqual({ text: "Participant", chip: true, tone: "neutral" });
    expect(cellOf(users.fields[4]!, row(), "en", none)).toEqual({ text: "Not answered", chip: false, tone: "neutral" });
  });

  test("a yes/no is a chip: yes is good unless the list says otherwise; no label means nothing to show", () => {
    const published: FieldUi = { name: "published", kind: "boolean", label: { ja: "公開", en: "Published" }, inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } } };
    expect(cellOf(published, row({ published: true }), "ja", none)).toEqual({ text: "公開中", chip: true, tone: "good" });
    expect(cellOf(published, row({ published: false }), "ja", none)).toEqual({ text: "下書き", chip: true, tone: "neutral" });
    const checked: FieldUi = { ...published, inList: { yes: { ja: "確認済み", en: "Checked" }, no: { ja: "未確認", en: "Not checked" }, tone: { no: "warn" } } };
    expect(cellOf(checked, row({ published: false }), "ja", none).tone).toBe("warn");
    const onlyYes: FieldUi = { ...published, inList: { yes: { ja: "許可あり", en: "Allowed" } } };
    expect(cellOf(onlyYes, row({ published: false }), "ja", none).text).toBe("");
  });
});

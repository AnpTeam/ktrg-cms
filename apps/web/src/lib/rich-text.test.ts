import { describe, expect, test } from "bun:test";
import { parseRich, plainRich } from "./rich-text";

describe("rich text", () => {
  test("a link keeps its words and only http(s) addresses become links", () => {
    expect(parseRich("見る [公式](https://example.com/a?b=1) へ").body).toEqual(["見る ", { href: "https://example.com/a?b=1", label: "公式" }, " へ"]);
    expect(parseRich("[x](javascript:alert(1))").body).toEqual(["[x](javascript:alert(1))"]);
    expect(parseRich("[x](/relative)").body).toEqual(["[x](/relative)"]);
  });

  test("footnotes are numbered by first mention; their lines leave the body", () => {
    const r = parseRich("甲[^b]乙[^a]丙[^b]\n[^a]: 注A\n[^b]: 注B [ここ](https://example.com)");
    expect(r.body).toEqual(["甲", { note: 1 }, "乙", { note: 2 }, "丙", { note: 1 }]);
    expect(r.notes).toEqual([
      { n: 1, parts: ["注B ", { href: "https://example.com", label: "ここ" }] },
      { n: 2, parts: ["注A"] },
    ]);
  });

  test("a marker with no note stays as typed, and a note nobody mentions is dropped", () => {
    expect(parseRich("本文[^x]\n[^y]: 使われない")).toEqual({ body: ["本文[^x]"], notes: [] });
  });

  test("plain text, line breaks and CRLF are kept; the plain form drops markup", () => {
    expect(parseRich("一行目\r\n二行目").body).toEqual(["一行目\n二行目"]);
    expect(plainRich("[公式](https://example.com)の話[^1]\n[^1]: 注")).toBe("公式の話");
  });
});

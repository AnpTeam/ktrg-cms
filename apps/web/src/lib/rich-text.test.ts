import { describe, expect, test } from "bun:test";
import { parseBlocks, parseRich, plainBody, plainRich } from "./rich-text";

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

  test("the inline parser is unchanged by the block layer: a heading or a dash is just text to it", () => {
    expect(parseRich("## 見出し").body).toEqual(["## 見出し"]);
    expect(parseRich("- 一つ\n- 二つ").body).toEqual(["- 一つ\n- 二つ"]);
  });
});

describe("rich text blocks (the blog body)", () => {
  test("blank lines separate paragraphs, and single line breaks stay inside one", () => {
    expect(parseBlocks("一段目の一行\n一段目の二行\n\n二段目").blocks).toEqual([
      { kind: "p", parts: ["一段目の一行\n一段目の二行"] },
      { kind: "p", parts: ["二段目"] },
    ]);
  });

  test("## and ### are headings, and their words may hold a link", () => {
    expect(parseBlocks("## 金剛山\n### 秋\n#### ちがう").blocks).toEqual([
      { kind: "h", level: 2, parts: ["金剛山"] },
      { kind: "h", level: 3, parts: ["秋"] },
      { kind: "p", parts: ["#### ちがう"] }, // only ## and ### are headings
    ]);
    expect(parseBlocks("## [公式](https://example.com)より").blocks).toEqual([
      { kind: "h", level: 2, parts: [{ href: "https://example.com", label: "公式" }, "より"] },
    ]);
  });

  test("dashes at the start of a line become one list, and the next paragraph ends it", () => {
    expect(parseBlocks("持ち物\n- 水\n- 地図\nそのほか").blocks).toEqual([
      { kind: "p", parts: ["持ち物"] },
      { kind: "ul", items: [["水"], ["地図"]] },
      { kind: "p", parts: ["そのほか"] },
    ]);
  });

  test("a photo alone on its line becomes a photo, and only https is accepted", () => {
    expect(parseBlocks("![紅葉](https://img.example.com/a.jpg)").blocks).toEqual([
      { kind: "photo", src: "https://img.example.com/a.jpg", alt: "紅葉" },
    ]);
    // Not https: it stays text, so nothing loads from a plain-http host.
    expect(parseBlocks("![x](http://img.example.com/a.jpg)").blocks[0]!.kind).toBe("p");
    // Not alone on its line: the words around it keep it inline, where it reads as a link.
    expect(parseBlocks("見て ![x](https://img.example.com/a.jpg)").blocks[0]!.kind).toBe("p");
  });

  test("footnotes are numbered across the whole text, wherever their blocks are", () => {
    const r = parseBlocks("## 見出し[^b]\n\n本文[^a]\n\n[^a]: 注A\n[^b]: 注B");
    expect(r.blocks).toEqual([
      { kind: "h", level: 2, parts: ["見出し", { note: 1 }] },
      { kind: "p", parts: ["本文", { note: 2 }] },
    ]);
    expect(r.notes).toEqual([
      { n: 1, parts: ["注B"] },
      { n: 2, parts: ["注A"] },
    ]);
  });

  test("the plain form of a body keeps the words of headings and lists, and drops photos", () => {
    expect(plainBody("## 秋の金剛山\n\n[紅葉](https://example.com)が見事。\n\n- 水\n\n![写真](https://img.example.com/a.jpg)")).toBe(
      "秋の金剛山 紅葉が見事。 水",
    );
  });
});

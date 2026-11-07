import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { bodyToDoc, cardParts, docToBody, moveBlock } from "./block-doc";
import { parsePageBody } from "@/lib/page-text";
import { CardTitle, PageCard } from "./card-nodes";

const roundTrip = (body: string) => docToBody(bodyToDoc(body));
const schema = getSchema([StarterKit.configure({ heading: { levels: [2, 3] } }), Image]);

describe("short text", () => {
  const short = (body: string) => docToBody(bodyToDoc(body, "short"));
  const shortSchema = getSchema([StarterKit.configure({ orderedList: false, heading: false, bulletList: false, listItem: false, listKeymap: false, horizontalRule: false })]);

  test("every line comes back as written, and what only long text has stays words", () => {
    const body = ["一行目\n二行目", "- 箇条書きではない\n## 見出しではない", "---", "![写真ではない](https://e.com/a.jpg)", "**太字**と__斜体__と[リンク](https://e.com)[^1]", "[^1]: 注の文"].join("\n\n");
    expect(short(body)).toBe(body);
    expect(bodyToDoc(body, "short").content!.every((b) => b.type === "paragraph")).toBe(true);
  });

  test("the short editor's schema accepts it, and nothing stays nothing", () => {
    expect(() => shortSchema.nodeFromJSON(bodyToDoc("- a\n\n## b\n\n---", "short")).check()).not.toThrow();
    expect(short("")).toBe("");
  });
});

describe("card blocks", () => {
  const cards = (body: string) => docToBody(bodyToDoc(body, "cards"));
  const cardSchema = getSchema([StarterKit.configure({ heading: { levels: [2, 3] } }), Image, CardTitle, PageCard]);
  const body = ["前の文", ":::card 題\n一つ目\n\n- 項目\n\n![写真](https://e.com/a.jpg)\n:::", ":::step 手順\n**太字**の文\n:::", ":::faq 問い\n答え\n:::", "後の文"].join("\n\n");

  test("every kind comes back as written, and the real schema accepts it", () => {
    expect(cards(body)).toBe(body);
    expect(() => cardSchema.nodeFromJSON(bodyToDoc(body, "cards")).check()).not.toThrow();
  });

  test("an empty card is still valid, a heading inside stays words, and without cards ::: stays words", () => {
    expect(() => cardSchema.nodeFromJSON(bodyToDoc(":::card\n:::", "cards")).check()).not.toThrow();
    expect(cards(":::card\n:::")).toBe(":::card\n:::");
    const typed = ":::card 題\n## 見出し\n\n---\n:::";
    expect(() => cardSchema.nodeFromJSON(bodyToDoc(typed, "cards")).check()).not.toThrow();
    expect(cards(typed)).toBe(":::card 題\n## 見出し\n\n---\n:::");
    expect(bodyToDoc(":::card 題\n:::").content!.every((b) => b.type === "paragraph")).toBe(true);
  });

  test("a card moves whole", () => {
    const doc = cardSchema.nodeFromJSON(bodyToDoc("前\n\n:::card 題\n本文\n:::", "cards"));
    const state = EditorState.create({ doc, schema: cardSchema });
    const inCard = state.apply(state.tr.setSelection(TextSelection.create(doc, 8)));
    const moved = inCard.apply(moveBlock(inCard, -1)!);
    expect(docToBody(moved.doc.toJSON())).toBe(":::card 題\n本文\n:::\n\n前");
  });
});

describe("cards in the editor", () => {
  const parts = (body: string, look: "faq" | "guide") => cardParts((bodyToDoc(body).content ?? []).map((b) => ({ type: b.type!, level: b.attrs?.level as number | undefined })), look);
  const count = (body: string, look: "faq" | "guide", name: string) => parts(body, look).filter((p) => p.className.split(" ").includes(name)).length;

  test("as many cards and the same note as the page itself", () => {
    const body = "はじめ\n\n## 一\n本文\n\n### 小\n\n本文\n\n## 二\n\n---\n\n注意\n\n## 注意の中\n\n続き";
    const guide = parsePageBody(body, true);
    expect(count(body, "guide", "card-head")).toBe(guide.sections.length);
    expect(count(body, "guide", "card-note")).toBe(3); // a heading after the line stays in the note
    expect(guide.note.length).toBeGreaterThan(0);
    expect(count(body, "faq", "card-head")).toBe(parsePageBody(body).sections.length);
    expect(count(body, "faq", "card-note")).toBe(0); // the line is only a line on the FAQ
  });

  test("a card closes before the next one and the steps count up", () => {
    const shown = parts("## 一\n本文\n\n## 二", "guide");
    expect(shown.map((p) => p.step)).toEqual([1, undefined, 2]);
    expect(shown.map((p) => p.className.includes("card-end"))).toEqual([false, true, true]);
  });

  test("text before the first question is marked as not shown, on the FAQ only", () => {
    expect(parts("はじめ\n\n## 問い", "faq")[0]).toEqual({ className: "page-hidden", hidden: true });
    expect(parts("はじめ\n\n## 問い", "guide")[0]).toEqual({ className: "" });
  });
});

describe("block document", () => {
  test("every block comes back as it was written", () => {
    const body = [
      "はじめの文。\n二行目。",
      "## 見出し",
      "### 小見出し",
      "**太字**と[リンク](https://example.com/a?b=1)の文。[^1]",
      "- ひとつ\n- **ふたつ**",
      "---",
      "![山の写真](https://example.com/a.jpg)",
      "[^1]: 注の文",
    ].join("\n\n");
    expect(roundTrip(body)).toBe(body);
  });

  test("bold, italic and underline come back, alone or together, on links too", () => {
    for (const body of ["**a**と__b__と++c++", "**__a__**", "**++__a__++**", "++[a](https://e.com)++"]) expect(roundTrip(body)).toBe(body);
  });

  test("a space inside a marked run stays outside its markers", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a " }, { type: "text", text: "b ", marks: [{ type: "italic" }] }, { type: "text", text: "c" }] }] };
    expect(docToBody(doc)).toBe("a __b__ c");
  });

  test("the schema of the real editor accepts the document", () => {
    expect(() => schema.nodeFromJSON(bodyToDoc("## 見出し\n本文\n- a\n\n---\n\n![x](https://e.com/a.jpg)")).check()).not.toThrow();
    expect(schema.nodeFromJSON(bodyToDoc("")).childCount).toBe(1);
  });

  test("a heading keeps its words as typed, and an empty block leaves nothing", () => {
    expect(roundTrip("## [a](https://e.com) **b**")).toBe("## [a](https://e.com) **b**");
    expect(docToBody({ type: "doc", content: [{ type: "paragraph" }, { type: "heading", attrs: { level: 2 } }, { type: "paragraph" }] })).toBe("");
  });

  test("what the page could not show is not written", () => {
    const link = (href: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }] });
    expect(docToBody(link("javascript:alert(1)"))).toBe("x");
    expect(docToBody(link("https://e.com/a b(c)"))).toBe("[x](https://e.com/a%20b(c%29)");
    expect(docToBody({ type: "doc", content: [{ type: "image", attrs: { src: "http://e.com/a.jpg" } }] })).toBe("");
    expect(docToBody({ type: "doc", content: [{ type: "image", attrs: { src: "https://e.com/a.jpg", alt: "a]\nb" } }] })).toBe("![a  b](https://e.com/a.jpg)");
  });

  test("a pasted nested list becomes one flat list", () => {
    const item = (text: string, ...rest: object[]) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }, ...rest] });
    expect(docToBody({ type: "doc", content: [{ type: "bulletList", content: [item("a", { type: "bulletList", content: [item("b")] })] }] })).toBe("- a\n- b");
  });

  test("a block moves past its neighbour and keeps the cursor", () => {
    const doc = schema.nodeFromJSON(bodyToDoc("一\n\n二\n\n三"));
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, 5) }); // in 二
    const down = state.apply(moveBlock(state, 1)!);
    expect(docToBody(down.doc.toJSON())).toBe("一\n\n三\n\n二");
    expect(down.selection.$from.parent.textContent).toBe("二");
    const up = state.apply(moveBlock(state, -1)!);
    expect(docToBody(up.doc.toJSON())).toBe("二\n\n一\n\n三");
    expect(moveBlock(up, -1)).toBeNull();
  });
});

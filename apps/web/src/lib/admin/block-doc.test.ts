import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { bodyToDoc, docToBody, moveBlock } from "./block-doc";

const roundTrip = (body: string) => docToBody(bodyToDoc(body));
const schema = getSchema([StarterKit.configure({ heading: { levels: [2, 3] } }), Image]);

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

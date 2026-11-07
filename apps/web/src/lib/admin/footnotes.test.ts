import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { parseBlocks, parseRich, type Inline } from "@/lib/rich-text";
import { bodyToDoc, docToBody } from "./block-doc";
import { CardTitle, PageCard } from "./card-nodes";
import { noteProblems, noteSpots, renumberNotes } from "./footnotes";

const schema = getSchema([StarterKit.configure({ heading: { levels: [2, 3] } }), Image, CardTitle, PageCard]);
const stateOf = (body: string, mode: "short" | "cards") => EditorState.create({ doc: schema.nodeFromJSON(bodyToDoc(body, mode)), schema });
const fixed = (body: string, mode: "short" | "cards" = "cards") => {
  const state = stateOf(body, mode);
  const tr = renumberNotes(state);
  return docToBody((tr ? state.apply(tr) : state).doc.toJSON());
};

/** Words of a note as the page gives them. */
const said = (parts: Inline[]) => parts.map((p) => (typeof p === "string" ? p : "")).join("");
/** The notes as the page numbers them, in the order they are read. */
const onThePage = (body: string) => {
  const { notes } = parseRich(body);
  return notes.map((n) => [n.n, said(n.parts)]);
};
/** The notes as the editor's text calls them, for the marks in the order they are read. */
const inTheEditor = (body: string) => {
  const lines = body.split("\n");
  const defs = new Map(lines.flatMap((l) => (/^\[\^(\d+)\]:\s*(.*)$/.exec(l) ? [[Number(/^\[\^(\d+)/.exec(l)![1]), l.replace(/^\[\^\d+\]:\s*/, "")] as const] : [])));
  const words = lines.filter((l) => !/^\[\^\d+\]:/.test(l)).join("\n");
  const seen = [...new Set([...words.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1])))].filter((n) => defs.has(n));
  return seen.map((n) => [n, defs.get(n)!]);
};

describe("the editor's footnote numbers are the page's", () => {
  const cases: { name: string; body: string; want: string; mode?: "short" | "cards" }[] = [
    { name: "a note added above an older one", body: "a[^2] b[^1]\n\n[^1]: 古い\n\n[^2]: 新しい", want: "a[^1] b[^2]\n\n[^1]: 新しい\n\n[^2]: 古い" },
    { name: "a mark used twice", body: "a[^2] b[^1] c[^2]\n\n[^1]: 一\n\n[^2]: 二", want: "a[^1] b[^2] c[^1]\n\n[^1]: 二\n\n[^2]: 一" },
    { name: "a name instead of a number", body: "a[^src]\n\n[^src]: 資料", want: "a[^1]\n\n[^1]: 資料" },
    { name: "numbers with a gap", body: "a[^3] b[^7]\n\n[^3]: 一\n\n[^7]: 二", want: "a[^1] b[^2]\n\n[^1]: 一\n\n[^2]: 二" },
    { name: "a note nobody mentions goes last", body: "a[^2]\n\n[^1]: 余り\n\n[^2]: 使う", want: "a[^1]\n\n[^1]: 使う\n\n[^2]: 余り" },
    { name: "a mark with no note does not take a number", body: "a[^1] b[^2]\n\n[^2]: 二", want: "a[^2] b[^1]\n\n[^1]: 二" },
    { name: "marks in a card count where they are", body: "a[^2]\n\n:::card 題\nb[^1]\n:::\n\n[^1]: 二\n\n[^2]: 一", want: "a[^1]\n\n:::card 題\nb[^2]\n:::\n\n[^1]: 一\n\n[^2]: 二" },
    { name: "older text with the notes under the words", body: "本文[^2]と[^1]\n[^1]: 一\n[^2]: 二", want: "本文[^1]と[^2]\n[^2]: 一\n[^1]: 二", mode: "short" },
    { name: "a bold note keeps its bold", body: "a[^2] b[^1]\n\n[^1]: **一**\n\n[^2]: 二", want: "a[^1] b[^2]\n\n[^1]: 二\n\n[^2]: **一**" },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const out = fixed(c.body, c.mode);
      expect(out).toBe(c.want);
      expect(fixed(out, c.mode)).toBe(out); // and it stays put
    });
  }

  test("what the editor calls each note is what the page numbers it", () => {
    for (const c of cases) {
      if (c.body.includes(":::")) continue;
      const out = fixed(c.body, c.mode);
      expect(inTheEditor(out).map(([n]) => n)).toEqual(onThePage(out).map(([n]) => n));
    }
  });

  test("a card's notes are numbered by the page in the same order", () => {
    const out = fixed("a[^2]\n\n:::card 題\nb[^1]\n:::\n\n[^1]: 二\n\n[^2]: 一");
    expect(parseBlocks(out).notes.map((n) => [n.n, said(n.parts)])).toEqual([[1, "一"], [2, "二"]]);
  });
});

describe("while writing", () => {
  test("text already in order is left alone", () => {
    expect(renumberNotes(stateOf("a[^1] b[^2]\n\n[^1]: 一\n\n[^2]: 二", "cards"))).toBeNull();
    expect(renumberNotes(stateOf("no notes", "cards"))).toBeNull();
  });

  test("the caret stays in the note being written when its line moves", () => {
    const state = stateOf("a[^2] b[^1]\n\n[^1]: 古い\n\n[^2]: 新しい", "cards");
    const end = state.doc.content.size - 1; // the end of the last line, the new note
    const writing = state.apply(state.tr.setSelection(TextSelection.create(state.doc, end)));
    const moved = writing.apply(renumberNotes(writing)!);
    expect(moved.selection.$from.parent.textContent).toBe("[^1]: 新しい");
    expect(moved.selection.$from.parentOffset).toBe("[^1]: 新しい".length);
  });

  test("a mark inside a note is not counted, and problems are named", () => {
    const spots = (body: string) => noteSpots(stateOf(body, "cards").doc);
    expect(noteProblems(spots("a[^1]\n\n[^1]: b[^9]"))).toEqual({ missing: new Set(), unused: new Set() });
    const { missing, unused } = noteProblems(spots("a[^1]\n\n[^2]: 余り"));
    expect([...missing]).toEqual(["1"]);
    expect([...unused]).toEqual(["2"]);
  });
});

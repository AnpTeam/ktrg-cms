import { Fragment, type Mark, type Node } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

// The page numbers footnotes by where they are first mentioned, whatever the text calls them (lib/rich-text.ts). Left alone, a
// footnote added above an older one reads [^2] here and 1 on the page. So the editor keeps the text in the page's order: the
// marks count up as they are read and the note lines follow. Pure, over the document; tested in footnotes.test.ts.

const MARK = /\[\^([\w-]+)\]/g;

interface Spot {
  from: number;
  to: number;
  id: string;
  marks: readonly Mark[];
  /** "[^1]:" at the start of a line, which holds the note, and not a mark in the text. */
  label: boolean;
  /** Inside a note: the page shows a mark there as typed, so it does not count. */
  inNote: boolean;
}

export function noteSpots(doc: Node): Spot[] {
  const spots: Spot[] = [];
  let noteLine = false;
  let lineStart = true;
  doc.descendants((node, at) => {
    if (node.isTextblock || node.type.name === "hardBreak") {
      noteLine = false;
      lineStart = true;
      return true;
    }
    if (!node.isText) return true;
    const text = node.text!;
    for (const m of text.matchAll(MARK)) {
      const label = lineStart && m.index === 0 && text[m[0].length] === ":";
      spots.push({ from: at + m.index, to: at + m.index + m[0].length, id: m[1]!, marks: node.marks, label, inNote: noteLine && !label });
      if (label) noteLine = true;
    }
    lineStart = false;
    return false;
  });
  return spots;
}

/** Marks with no note (the page shows them as typed) and notes nobody mentions (the page leaves them out). */
export function noteProblems(spots: readonly Spot[]): { missing: Set<string>; unused: Set<string> } {
  const mentioned = new Set(spots.filter((s) => !s.label && !s.inNote).map((s) => s.id));
  const defined = new Set(spots.filter((s) => s.label).map((s) => s.id));
  return { missing: new Set([...mentioned].filter((id) => !defined.has(id))), unused: new Set([...defined].filter((id) => !mentioned.has(id))) };
}

/** The number each id should have: those the page numbers come first and in its order, as only they are counted there. */
function numbersOf(spots: readonly Spot[]): Map<string, number> {
  const { missing, unused } = noteProblems(spots);
  const mentioned = [...new Set(spots.filter((s) => !s.label && !s.inNote).map((s) => s.id))];
  const order = [...mentioned.filter((id) => !missing.has(id)), ...unused, ...missing];
  return new Map(order.map((id, i) => [id, i + 1]));
}

/** What keeps the text in the page's order, or null when it already is. */
export function renumberNotes(state: EditorState): Transaction | null {
  const spots = noteSpots(state.doc);
  if (spots.length === 0) return null;
  const numbers = numbersOf(spots);
  const tr = state.tr;
  // From the end, so the places found above stay right.
  for (const s of [...spots].reverse()) {
    const n = numbers.get(s.id);
    if (n !== undefined && s.id !== String(n)) tr.replaceWith(s.from, s.to, state.schema.text(`[^${n}]`, s.marks));
  }

  // The note lines follow, each a paragraph of its own. An older text may keep a note under its words: that one stays there.
  const notes: { at: number; node: Node; n: number }[] = [];
  tr.doc.forEach((node, at) => {
    const m = node.type.name === "paragraph" ? /^\[\^(\d+)\]:/.exec(node.textContent) : null;
    if (m) notes.push({ at, node, n: Number(m[1]) });
  });
  const sorted = [...notes].sort((a, b) => a.n - b.n);
  if (sorted.some((note, i) => note !== notes[i])) {
    const caret = tr.selection.from;
    const holder = notes.find((note) => caret > note.at && caret < note.at + note.node.nodeSize);
    const start = notes[0]!.at;
    for (const note of [...notes].reverse()) tr.delete(note.at, note.at + note.node.nodeSize);
    tr.insert(start, Fragment.fromArray(sorted.map((note) => note.node)));
    if (holder) {
      const before = sorted.slice(0, sorted.indexOf(holder)).reduce((size, note) => size + note.node.nodeSize, 0);
      tr.setSelection(TextSelection.create(tr.doc, start + before + (caret - holder.at)));
    }
  }
  return tr.docChanged ? tr : null;
}

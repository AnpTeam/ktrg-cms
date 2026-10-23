// What the editor's text buttons do to a text, in the markup lib/rich-text.ts reads: a link is [words](https://…), a
// footnote is [^n] in the text and a line "[^n]: the note" at the end. Pure: given the text and the selection, they
// return the new text and where the selection goes, so the rules are tested without a browser.

export interface Edit {
  text: string;
  /** The selection afterwards (start, end). */
  select: [number, number];
}

const PLACEHOLDER = "リンクの文字";
const ADDRESS = "https://";

/** Wrap the selected words as a link and select the address, ready to be typed over; with nothing selected, add a link with a placeholder word. */
export function withLink(text: string, start: number, end: number): Edit {
  const words = text.slice(start, end) || PLACEHOLDER;
  const before = text.slice(0, start);
  const open = `[${words}](`;
  return { text: `${before}${open}${ADDRESS})${text.slice(end)}`, select: [before.length + open.length, before.length + open.length + ADDRESS.length] };
}

/** The next free footnote number: one more than the highest [^n] already in the text. */
export function nextNote(text: string): number {
  const numbers = [...text.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
  return Math.max(0, ...numbers) + 1;
}

/** Put [^n] at the cursor and a "[^n]: " line at the end of the text, with the selection after it to type the note. */
export function withFootnote(text: string, at: number): Edit {
  const n = nextNote(text);
  const mark = `[^${n}]`;
  const body = `${text.slice(0, at)}${mark}${text.slice(at)}`;
  const line = `${body === "" || body.endsWith("\n") ? "" : "\n"}[^${n}]: `;
  const out = `${body}${line}`;
  return { text: out, select: [out.length, out.length] };
}

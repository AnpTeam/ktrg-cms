// The next free footnote number, for the editor's footnote button (a footnote is [^n] in the text, see lib/rich-text.ts).

/** The next free footnote number: one more than the highest [^n] already in the text. */
export function nextNote(text: string): number {
  const numbers = [...text.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
  return Math.max(0, ...numbers) + 1;
}

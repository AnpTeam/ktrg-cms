// The only markup editors can type in a description, history, access, source or photo credit:
//   [shown words](https://example.com)   a link (http or https only)
//   [^1] in the text, and a line "[^1]: the note" anywhere   a footnote
// Everything else is plain text (line breaks are kept by the page). Never HTML: the parts below are rendered as React
// text and anchors, so nothing typed here can run as script. Tests are in rich-text.test.ts.

export type Inline = string | { href: string; label: string } | { note: number };

export interface Rich {
  body: Inline[];
  /** In the order they are first mentioned in the body. A note nobody mentions is dropped. */
  notes: { n: number; parts: Inline[] }[];
}

const TOKEN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\[\^([\w-]+)\]/g;
const DEFINITION = /^\[\^([\w-]+)\]:[ \t]*(.*)$/;

function inline(text: string, noteOf?: (id: string) => number | null): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    const note = m[3] !== undefined ? (noteOf?.(m[3]) ?? null) : null;
    // A [^x] with no note to point at stays as typed, so a typo is visible rather than lost.
    if (m[3] !== undefined && note === null) continue;
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(note !== null ? { note } : { href: m[2]!, label: m[1]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/**
 * Pulls the footnote definitions out, leaving the other lines, and hands back the numbering so every block of one
 * text shares one list of notes.
 */
function withNotes(text: string) {
  const defs = new Map<string, string>();
  const lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const d = DEFINITION.exec(line);
    if (d) defs.set(d[1]!, d[2]!);
    else lines.push(line);
  }
  const numbers = new Map<string, number>();
  const noteOf = (id: string) => {
    if (!defs.has(id)) return null;
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    return numbers.get(id)!;
  };
  // Read after the body is parsed: only the notes the body actually mentions, in that order.
  const mentioned = () => [...numbers].map(([id, n]) => ({ n, parts: inline(defs.get(id)!) }));
  return { lines, noteOf, mentioned };
}

export function parseRich(text: string): Rich {
  const { lines, noteOf, mentioned } = withNotes(text);
  const body = inline(lines.join("\n").trim(), noteOf);
  return { body, notes: mentioned() };
}

/** The words alone, for places with no room for links or notes (a clamped card): links keep their words, notes go. */
export function plainRich(text: string): string {
  return parseRich(text)
    .body.map((p) => (typeof p === "string" ? p : "href" in p ? p.label : ""))
    .join("");
}

// ---- Blocks: a longer text, for the blog -------------------------------------------------------------------
// A blog post needs more than one run of words, so on top of the markers above these work at the start of a line:
//   ## a heading, ### a smaller heading
//   - a bullet list (one item per line)
//   ![what the photo shows](https://example.com/a.jpg)   a photo, alone on its line, https only
// A blank line starts a new paragraph. Everything else is a paragraph, keeping its line breaks. Still never HTML:
// RichBody renders these as React elements. The inline markers are parsed by the same code as above, so links and
// footnotes behave identically and the notes are numbered across the whole text.

export type Block =
  | { kind: "p"; parts: Inline[] }
  | { kind: "h"; level: 2 | 3; parts: Inline[] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "photo"; src: string; alt: string };

export interface RichBody {
  blocks: Block[];
  notes: Rich["notes"];
}

const HEADING = /^(##|###)[ \t]+(.*)$/;
const ITEM = /^-[ \t]+(.*)$/;
// Alone on its line, and https only: a photo address is loaded by the visitor's browser.
const PHOTO = /^!\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)[ \t]*$/;

export function parseBlocks(text: string): RichBody {
  const { lines, noteOf, mentioned } = withNotes(text);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let items: string[] | null = null;

  const endParagraph = () => {
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ kind: "p", parts: inline(joined, noteOf) });
    paragraph = [];
  };
  const endList = () => {
    if (items?.length) blocks.push({ kind: "ul", items: items.map((i) => inline(i, noteOf)) });
    items = null;
  };
  const endBoth = () => {
    endParagraph();
    endList();
  };

  for (const line of lines) {
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    const photo = PHOTO.exec(line);
    if (heading) {
      endBoth();
      blocks.push({ kind: "h", level: heading[1] === "##" ? 2 : 3, parts: inline(heading[2]!.trim(), noteOf) });
    } else if (photo) {
      endBoth();
      blocks.push({ kind: "photo", src: photo[2]!, alt: photo[1]!.trim() });
    } else if (item) {
      endParagraph();
      (items ??= []).push(item[1]!.trim());
    } else if (line.trim() === "") {
      endBoth();
    } else {
      endList();
      paragraph.push(line);
    }
  }
  endBoth();
  // mentioned() last: the notes are known only once every block has been parsed.
  return { blocks, notes: mentioned() };
}

/** The words of a long text, for a card that shows the beginning of a post: headings and list items included, photos not. */
export function plainBody(text: string): string {
  const words = (parts: Inline[]) => parts.map((p) => (typeof p === "string" ? p : "href" in p ? p.label : "")).join("");
  return parseBlocks(text)
    .blocks.flatMap((b) => (b.kind === "photo" ? [] : b.kind === "ul" ? b.items.map(words) : [words(b.parts)]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

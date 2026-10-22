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

export function parseRich(text: string): Rich {
  const defs = new Map<string, string>();
  const lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const d = DEFINITION.exec(line);
    if (d) defs.set(d[1]!, d[2]!);
    else lines.push(line);
  }
  const numbers = new Map<string, number>();
  const body = inline(lines.join("\n").trim(), (id) => {
    if (!defs.has(id)) return null;
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    return numbers.get(id)!;
  });
  const notes = [...numbers].map(([id, n]) => ({ n, parts: inline(defs.get(id)!) }));
  return { body, notes };
}

/** The words alone, for places with no room for links or notes (a clamped card): links keep their words, notes go. */
export function plainRich(text: string): string {
  return parseRich(text)
    .body.map((p) => (typeof p === "string" ? p : "href" in p ? p.label : ""))
    .join("");
}

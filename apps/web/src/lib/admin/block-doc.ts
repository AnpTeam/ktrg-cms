import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { JSONContent } from "@tiptap/core";
import { CARD_CLOSE, CARD_OPEN, HEADING, inline, ITEM, PHOTO, PLACE, RULE, TABLE_ROW, TABLE_RULE, tableCells, type Inline } from "@/lib/rich-text";

// The block editor's document and the plain text the site stores (the format of lib/rich-text.ts), both ways. The text stays
// the stored form, so the public pages need no editor code and every page written before keeps working. Written here and not
// with @tiptap/markdown: that one is in beta and its Markdown is not this format.

const textNodes = (parts: Inline[], marks: NonNullable<JSONContent["marks"]> = []): JSONContent[] =>
  parts.flatMap((p): JSONContent[] => {
    if (typeof p === "string") return p ? [{ type: "text", text: p, ...(marks.length ? { marks } : {}) }] : [];
    if ("href" in p) return [{ type: "text", text: p.label, marks: [...marks, { type: "link", attrs: { href: p.href } }] }];
    if ("bold" in p) return textNodes(p.bold, [...marks, { type: "bold" }]);
    if ("italic" in p) return textNodes(p.italic, [...marks, { type: "italic" }]);
    if ("underline" in p) return textNodes(p.underline, [...marks, { type: "underline" }]);
    return [];
  });

/** A run of text with its line breaks. Footnote marks stay as the words [^1], as there is no block for them. */
const inlineContent = (text: string): JSONContent[] =>
  text.split("\n").flatMap((line, i) => [...(i > 0 ? [{ type: "hardBreak" }] : []), ...textNodes(inline(line))]);

/** A short text (RichText on the page): only paragraphs. A line starting "- " or "## " is shown as typed there, so it stays words here. */
function shortDoc(body: string): JSONContent {
  const content = body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((p): JSONContent => ({ type: "paragraph", content: inlineContent(p) }));
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** A card's text: what a card can hold. A heading or a line typed inside one stays words, so nothing is lost. */
const cardInside = (lines: string[]): JSONContent[] => {
  const inside = (bodyToDoc(lines.join("\n")).content ?? []).map((b): JSONContent => {
    if (b.type !== "heading" && b.type !== "horizontalRule") return b;
    const words = blockText(b);
    return { type: "paragraph", content: [{ type: "text", text: words }] };
  });
  return inside.length ? inside : [{ type: "paragraph" }];
};

/** `short`: a text with no blocks (RichText). `cards`: this editor has cards; elsewhere a ::: line stays words. */
export function bodyToDoc(body: string, mode?: "short" | "cards"): JSONContent {
  if (mode === "short") return shortDoc(body);
  const content: JSONContent[] = [];
  let paragraph: string[] = [];
  let items: JSONContent[] = [];
  const endParagraph = () => {
    const text = paragraph.join("\n").trim();
    if (text) content.push({ type: "paragraph", content: inlineContent(text) });
    paragraph = [];
  };
  const endList = () => {
    if (items.length) content.push({ type: "bulletList", content: items });
    items = [];
  };
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at]!;
    const card = mode === "cards" ? CARD_OPEN.exec(line) : null;
    const place = mode === "cards" ? PLACE.exec(line) : null;
    if (place) {
      endParagraph();
      endList();
      content.push({ type: "placeBlock", attrs: { id: place[1]!.toLowerCase() } });
      continue;
    }
    if (mode === "cards" && TABLE_ROW.test(line)) {
      endParagraph();
      endList();
      let end = at;
      while (end < lines.length && TABLE_ROW.test(lines[end]!)) end++;
      const rows = lines.slice(at, end).filter((l) => !TABLE_RULE.test(l)).map(tableCells);
      const width = Math.max(...rows.map((r) => r.length));
      content.push({
        type: "table",
        content: rows.map((cells, r) => ({
          type: "tableRow",
          // Every row as wide as the widest: a table needs even rows.
          content: Array.from({ length: width }, (_, c) => ({ type: r === 0 ? "tableHeader" : "tableCell", content: [{ type: "paragraph", content: inlineContent(cells[c] ?? "") }] })),
        })),
      });
      at = end - 1;
      continue;
    }
    if (card) {
      endParagraph();
      endList();
      const close = lines.findIndex((l, i) => i > at && CARD_CLOSE.test(l));
      const end = close === -1 ? lines.length : close;
      const title = (card[2] ?? "").trim();
      content.push({ type: "pageCard", attrs: { kind: card[1] }, content: [{ type: "cardTitle", ...(title ? { content: [{ type: "text", text: title }] } : {}) }, ...cardInside(lines.slice(at + 1, end))] });
      at = end;
      continue;
    }
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    const photo = PHOTO.exec(line);
    const rule = RULE.test(line);
    if (item) {
      endParagraph();
      items.push({ type: "listItem", content: [{ type: "paragraph", content: inlineContent(item[1]!.trim()) }] });
    } else if (line.trim() !== "" && !heading && !photo && !rule) {
      endList();
      paragraph.push(line);
    } else {
      endParagraph();
      endList();
      // A heading's words are kept exactly as typed: the pages show a heading as plain words.
      if (heading) content.push({ type: "heading", attrs: { level: heading[1]!.length }, content: heading[2]!.trim() ? [{ type: "text", text: heading[2]!.trim() }] : [] });
      else if (photo) content.push({ type: "image", attrs: { src: photo[2], alt: photo[1]!.trim() } });
      else if (rule) content.push({ type: "horizontalRule" });
    }
  }
  endParagraph();
  endList();
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

const plain = (node: JSONContent): string => node.text ?? (node.type === "hardBreak" ? " " : (node.content ?? []).map(plain).join(""));

/** Innermost first. The markers must touch the words, so the spaces around them stay outside. */
const WRAPS = [["italic", "__"], ["underline", "++"], ["bold", "**"]] as const;

function inlineText(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      const text = n.text ?? "";
      const href = n.marks?.find((m) => m.type === "link")?.attrs?.href as string | undefined;
      const linked = href && /^https?:\/\//i.test(href) && !/[[\]]/.test(text) ? `[${text}](${href.replace(/\s/g, "%20").replace(/\)/g, "%29")})` : text;
      const [, before, words, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(linked)!;
      if (!words) return linked;
      const wrapped = WRAPS.reduce((w, [mark, marker]) => (n.marks?.some((m) => m.type === mark) ? `${marker}${w}${marker}` : w), words!);
      return `${before}${wrapped}${after}`;
    })
    .join("");
}

const isList = (node: JSONContent) => node.type === "bulletList" || node.type === "orderedList";

/** Every list item as one line, however deep it was pasted: the text has no nested lists. */
const listLines = (list: JSONContent): string[] =>
  (list.content ?? []).flatMap((item) => {
    const blocks = item.content ?? [];
    const own = blocks.filter((b) => !isList(b)).map((b) => inlineText(b.content).replace(/\n/g, " "));
    return [`- ${own.join(" ")}`, ...blocks.filter(isList).flatMap(listLines)];
  });

/** A cell's words on one line: its paragraphs joined, and a | written \| so it does not end the cell. */
const cellText = (cell: JSONContent): string =>
  (cell.content ?? [])
    .map((p) => inlineText(p.content).replace(/\n/g, " ").trim())
    .filter((t) => t !== "")
    .join(" ")
    .replace(/\|/g, "\\|");

function blockText(block: JSONContent): string {
  if (block.type === "placeBlock") {
    const id = String(block.attrs?.id ?? "");
    return PLACE.test(`::place ${id}`) ? `::place ${id}` : "";
  }
  if (block.type === "table") {
    const rows = (block.content ?? []).map((row) => `| ${(row.content ?? []).map(cellText).join(" | ")} |`);
    if (rows.length === 0) return "";
    const width = block.content?.[0]?.content?.length ?? 1;
    // The first row is the headings: the line under it says so to anyone reading the text.
    return [rows[0], `|${" --- |".repeat(width)}`, ...rows.slice(1)].join("\n");
  }
  if (block.type === "pageCard") {
    const [title, ...inside] = block.content ?? [];
    const words = inside.map(blockText).filter((b) => b !== "").join("\n\n");
    return `:::${String(block.attrs?.kind ?? "card")} ${plain(title ?? {}).trim()}`.trimEnd() + `\n${words ? `${words}\n` : ""}:::`;
  }
  if (block.type === "heading") {
    const words = plain(block).trim();
    return words ? `${"#".repeat(block.attrs?.level === 3 ? 3 : 2)} ${words}` : "";
  }
  if (block.type === "bulletList") return listLines(block).filter((line) => line !== "- ").join("\n");
  if (block.type === "horizontalRule") return "---";
  if (block.type === "image") {
    const src = String(block.attrs?.src ?? "");
    // The same rule as the page: a photo is https only.
    return /^https:\/\/\S+$/.test(src) ? `![${String(block.attrs?.alt ?? "").replace(/[[\]\n]/g, " ").trim()}](${src.replace(/\)/g, "%29")})` : "";
  }
  return inlineText(block.content).trim();
}

export const docToBody = (doc: JSONContent): string =>
  (doc.content ?? [])
    .map(blockText)
    .filter((text) => text !== "")
    .join("\n\n");

/** Swaps the block holding the cursor with the one above (-1) or below (1); null at the end of the page. */
export function moveBlock(state: EditorState, by: -1 | 1): Transaction | null {
  const { doc, selection } = state;
  const index = selection.$from.index(0);
  const other = index + by;
  if (other < 0 || other >= doc.childCount) return null;
  const [first, second] = by < 0 ? [other, index] : [index, other];
  let start = 0;
  for (let i = 0; i < first; i++) start += doc.child(i).nodeSize;
  const end = start + doc.child(first).nodeSize + doc.child(second).nodeSize;
  const tr = state.tr.replaceWith(start, end, [doc.child(second), doc.child(first)]);
  const at = selection.from + by * doc.child(other).nodeSize;
  return tr.setSelection(selection instanceof NodeSelection ? NodeSelection.create(tr.doc, at) : TextSelection.near(tr.doc.resolve(at))).scrollIntoView();
}

/** The pages whose headings become cards. */
export type PageLook = "faq" | "guide";

/**
 * How a page will draw each top-level block, so the editor can look the same: the split of parsePageBody (lib/page-text.ts),
 * which a test holds it to. The document stays a flat list; these only name a class for each block.
 */
export function cardParts(blocks: readonly { type: string; level?: number }[], look: PageLook): { className: string; step?: number; hidden?: true }[] {
  let part: "lead" | "section" | "note" = "lead";
  let step = 0;
  const kinds = blocks.map((b) => {
    if (b.type === "heading" && b.level === 2 && part !== "note") {
      part = "section";
      step += 1;
      return { kind: "head" as const, step };
    }
    if (look === "guide" && b.type === "horizontalRule" && part !== "note") {
      part = "note";
      return { kind: "rule" as const };
    }
    return { kind: part };
  });
  return kinds.map((k, i) => {
    const next = kinds[i + 1]?.kind;
    const end = next === undefined || next === "head" || next === "rule" ? " card-end" : "";
    if (k.kind === "head") return { className: `card-part card-head${end}`, step: k.step };
    if (k.kind === "section") return { className: `card-part${end}` };
    if (k.kind === "note") return { className: `card-part card-note${kinds[i - 1]?.kind === "rule" ? " card-note-first" : ""}${end}` };
    // The FAQ shows questions only: what comes before the first one is never drawn.
    if (k.kind === "lead" && look === "faq") return { className: "page-hidden", ...(i === 0 ? { hidden: true as const } : {}) };
    return { className: "" };
  });
}

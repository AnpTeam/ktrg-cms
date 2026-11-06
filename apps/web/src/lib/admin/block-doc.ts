import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { JSONContent } from "@tiptap/core";
import { HEADING, inline, ITEM, PHOTO, RULE, type Inline } from "@/lib/rich-text";

// The block editor's document and the plain text the site stores (the format of lib/rich-text.ts), both ways. The text stays
// the stored form, so the public pages need no editor code and every page written before keeps working. Written here and not
// with @tiptap/markdown: that one is in beta and its Markdown is not this format.

const textNodes = (parts: Inline[], marks: NonNullable<JSONContent["marks"]> = []): JSONContent[] =>
  parts.flatMap((p): JSONContent[] => {
    if (typeof p === "string") return p ? [{ type: "text", text: p, ...(marks.length ? { marks } : {}) }] : [];
    if ("href" in p) return [{ type: "text", text: p.label, marks: [...marks, { type: "link", attrs: { href: p.href } }] }];
    if ("bold" in p) return textNodes(p.bold, [...marks, { type: "bold" }]);
    return [];
  });

/** A run of text with its line breaks. Footnote marks stay as the words [^1], as there is no block for them. */
const inlineContent = (text: string): JSONContent[] =>
  text.split("\n").flatMap((line, i) => [...(i > 0 ? [{ type: "hardBreak" }] : []), ...textNodes(inline(line))]);

export function bodyToDoc(body: string): JSONContent {
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
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
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

function inlineText(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      const text = n.text ?? "";
      const href = n.marks?.find((m) => m.type === "link")?.attrs?.href as string | undefined;
      // A link's words stay plain: bold inside a link has no form in the text.
      if (href && /^https?:\/\//i.test(href) && !/[[\]]/.test(text)) return `[${text}](${href.replace(/\s/g, "%20").replace(/\)/g, "%29")})`;
      return n.marks?.some((m) => m.type === "bold") && text.trim() ? `**${text}**` : text;
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

function blockText(block: JSONContent): string {
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

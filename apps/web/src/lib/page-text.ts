// The text of a fixed page (FAQ, how to play, terms, privacy) when an editor has written it in 管理 > ページ.
// It is typed in a small plain format, so an editor needs no markup beyond what the rest of the site already reads
// (links and footnotes, see rich-text.ts):
//   the first paragraphs, before any heading        the opening text of the page
//   ## a heading, then paragraphs under it           a section (an FAQ question and its answer; a how-to-play step)
//   a line of three dashes (---)                     how to play: after it comes the closing note; elsewhere a line across the page
//   anything else rich-text.ts reads as a block      bold, lists, photos and smaller headings, inside a paragraph
// Paragraphs are separated by a blank line. Pure functions; tests are in page-text.test.ts.

import { CARD_CLOSE, CARD_OPEN } from "./rich-text";

export const PAGE_KEYS = ["home", "faq", "guide", "terms", "privacy"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export type PageLang = { title: string; body: string };
export type PageText = { ja: PageLang; en: PageLang };

export interface PageDoc {
  lead: string[];
  sections: { heading: string; paragraphs: string[] }[];
  note: string[];
}

const paragraphs = (lines: string[]) => {
  const out: string[] = [];
  let open = false; // inside a card
  for (const raw of lines.join("\n").split(/\n\s*\n/)) {
    const part = raw.trim();
    if (part === "") continue;
    const last = out[out.length - 1];
    const nextStep = last !== undefined && /^:::step\b/.test(part) && /(^|\n):::step\b/.test(last) && /\n:::$/.test(last);
    if (open || nextStep) out[out.length - 1] = `${last}\n\n${part}`;
    else out.push(part);
    const fences = part.split("\n").filter((l) => CARD_OPEN.test(l) || CARD_CLOSE.test(l)).length;
    if (fences % 2 === 1) open = !open;
  }
  return out;
};

export function parsePageBody(body: string, closingNote = false): PageDoc {
  const doc: PageDoc = { lead: [], sections: [], note: [] };
  let part: "lead" | "section" | "note" = "lead";
  let lines: string[] = [];
  let heading = "";
  const close = () => {
    if (part === "lead") doc.lead = paragraphs(lines);
    else if (part === "note") doc.note = paragraphs(lines);
    else doc.sections.push({ heading, paragraphs: paragraphs(lines) });
    lines = [];
  };
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const h = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (h && part !== "note") {
      close();
      part = "section";
      heading = h[1]!;
    } else if (closingNote && /^---[ \t]*$/.test(line) && part !== "note") {
      close();
      part = "note";
    } else lines.push(line);
  }
  close();
  return doc;
}

/** The text a page starts from in the editor: the same document, written back out in the format above. */
export function writePageBody(doc: PageDoc): string {
  const out: string[] = [...doc.lead];
  for (const s of doc.sections) out.push(`## ${s.heading}`, ...s.paragraphs);
  if (doc.note.length > 0) out.push("---", ...doc.note);
  return out.join("\n\n").replace(/(## [^\n]*)\n\n/g, "$1\n");
}

// The text of a fixed page (FAQ, how to play, terms, privacy) when an editor has written it in 管理 > ページの文章.
// It is typed in a small plain format, so an editor needs no markup beyond what the rest of the site already reads
// (links and footnotes, see rich-text.ts):
//   the first paragraphs, before any heading        the opening text of the page
//   ## a heading, then paragraphs under it           a section (an FAQ question and its answer; a how-to-play step)
//   a line of three dashes (---)                     after it comes the closing note (how to play)
// Paragraphs are separated by a blank line. Pure functions; tests are in page-text.test.ts.

export const PAGE_KEYS = ["home", "faq", "guide", "terms", "privacy"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export type PageLang = { title: string; body: string };
export type PageText = { ja: PageLang; en: PageLang };

export interface PageDoc {
  lead: string[];
  sections: { heading: string; paragraphs: string[] }[];
  note: string[];
}

const paragraphs = (lines: string[]) =>
  lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

export function parsePageBody(body: string): PageDoc {
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
    } else if (/^---[ \t]*$/.test(line) && part !== "note") {
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

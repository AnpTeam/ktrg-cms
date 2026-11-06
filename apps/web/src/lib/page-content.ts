import { helpContent, type Help } from "./help-content";
import { parsePageBody, type PageDoc, type PageText } from "./page-text";
import { privacyPolicy, type Policy } from "./privacy-content";
import { termsContent } from "./terms-content";

// A fixed page's own text laid over the page built into the app. Pure, so the public pages (with what is saved) and the
// admin's live preview (with what is being typed) come to the same result. A language with no title or no body shows the
// built-in page, so a page never goes empty.

export type OwnText = { title: string; doc: PageDoc } | null;

/** What the editor wrote for this visitor's language, read as a document; null when there is none (use the built-in page). */
export function ownText(text: PageText | null | undefined, locale: string, closingNote = false): OwnText {
  const lang = text?.[locale === "ja" ? "ja" : "en"];
  return lang && lang.title.trim() !== "" && lang.body.trim() !== "" ? { title: lang.title.trim(), doc: parsePageBody(lang.body, closingNote) } : null;
}

/** The how-to-play page and the FAQ (and their titles), with the editor's text where there is some. */
export function helpWith(locale: string, guide: OwnText, faq: OwnText): Help {
  return {
    ...helpContent(locale),
    ...(guide ? { guideTitle: guide.title, guideIntro: guide.doc.lead.join("\n\n"), steps: guide.doc.sections.map((s) => ({ title: s.heading, text: s.paragraphs.join("\n\n") })), guideNote: guide.doc.note.join("\n\n") } : {}),
    ...(faq ? { faqTitle: faq.title, faqs: faq.doc.sections.map((s) => ({ question: s.heading, answer: s.paragraphs.join("\n\n") })) } : {}),
  };
}

/** The privacy policy: the editor's text has no draft notice or "updated" line of its own (the text says what it needs to). */
export function policyWith(locale: string, mine: OwnText): Policy {
  if (!mine) return privacyPolicy(locale);
  return { title: mine.title, draftNotice: "", updated: "", sections: [...(mine.doc.lead.length ? [{ heading: "", paragraphs: mine.doc.lead }] : []), ...mine.doc.sections] };
}

export interface Terms {
  title: string;
  /** Null when the editor wrote the page: its own text carries the date. */
  updated: string | null;
  lead: string;
  intro: string[];
  sections: { heading: string; paragraphs: string[] }[];
  /** True when it is the built-in text (in Japanese only) and the page should say so, and carries the draft notice. */
  builtIn: boolean;
}

export function termsWith(mine: OwnText): Terms {
  if (mine) return { title: mine.title, updated: null, lead: "", intro: mine.doc.lead, sections: mine.doc.sections, builtIn: false };
  const t = termsContent;
  return { title: t.title, updated: t.updated, lead: t.lead, intro: [t.intro], sections: t.sections, builtIn: true };
}

export interface CustomPage {
  slug: string;
  titleJa: string;
  titleEn: string | null;
  bodyJa?: string;
  bodyEn?: string | null;
}

/** The page's title and text in the visitor's language: English when it is written and the visitor is not Japanese, else Japanese. */
export function customPageIn(page: CustomPage, locale: string): { title: string; doc: PageDoc } {
  const en = locale !== "ja" && page.titleEn ? page : null;
  return { title: en ? page.titleEn! : page.titleJa, doc: parsePageBody(en && page.bodyEn ? page.bodyEn : (page.bodyJa ?? "")) };
}

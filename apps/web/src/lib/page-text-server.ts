import { helpContent, type Help } from "./help-content";
import { parsePageBody, writePageBody, type PageDoc, type PageKey, type PageText } from "./page-text";
import { privacyPolicy, type Policy } from "./privacy-content";
import { termsContent } from "./terms-content";

// Server side: a fixed page's own text (see page-text.ts) laid over the page built into the app. A language with no
// title or no body, or an API that cannot be reached, shows the built-in page, so a page never goes empty.

async function savedPage(key: PageKey): Promise<PageText | null> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/pages/${key}`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; page?: PageText | null } | null;
    return res.ok && json?.ok === true ? (json.page ?? null) : null;
  } catch {
    return null;
  }
}

/** What the editor wrote for this visitor's language, read as a document; null when there is none (use the built-in page). */
async function own(key: PageKey, locale: string): Promise<{ title: string; doc: PageDoc } | null> {
  const lang = (await savedPage(key))?.[locale === "ja" ? "ja" : "en"];
  return lang && lang.title.trim() !== "" && lang.body.trim() !== "" ? { title: lang.title.trim(), doc: parsePageBody(lang.body) } : null;
}

/** The how-to-play page and the FAQ (and their titles), with the editor's text where there is some. */
export async function helpFor(locale: string): Promise<Help> {
  const help = helpContent(locale);
  const [guide, faq] = await Promise.all([own("guide", locale), own("faq", locale)]);
  return {
    ...help,
    ...(guide ? { guideTitle: guide.title, guideIntro: guide.doc.lead.join("\n\n"), steps: guide.doc.sections.map((s) => ({ title: s.heading, text: s.paragraphs.join("\n\n") })), guideNote: guide.doc.note.join("\n\n") } : {}),
    ...(faq ? { faqTitle: faq.title, faqs: faq.doc.sections.map((s) => ({ question: s.heading, answer: s.paragraphs.join("\n\n") })) } : {}),
  };
}

/** The privacy policy: the editor's text has no draft notice or "updated" line of its own (the text says what it needs to). */
export async function policyFor(locale: string): Promise<Policy> {
  const mine = await own("privacy", locale);
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

export async function termsFor(locale: string): Promise<Terms> {
  const mine = await own("terms", locale);
  if (mine) return { title: mine.title, updated: null, lead: mine.doc.lead[0] ?? "", intro: mine.doc.lead.slice(1), sections: mine.doc.sections, builtIn: false };
  const t = termsContent;
  return { title: t.title, updated: t.updated, lead: t.lead, intro: [t.intro], sections: t.sections, builtIn: true };
}

/** What each page says now, written out as the editor's text, for the editor to start from. */
export function builtInPages(): Record<PageKey, PageText> {
  const help = (l: "ja" | "en") => helpContent(l);
  const policy = (l: "ja" | "en") => privacyPolicy(l);
  const faq = (l: "ja" | "en") => ({ title: help(l).faqTitle, body: writePageBody({ lead: [], sections: help(l).faqs.map((f) => ({ heading: f.question, paragraphs: [f.answer] })), note: [] }) });
  const guide = (l: "ja" | "en") => ({ title: help(l).guideTitle, body: writePageBody({ lead: [help(l).guideIntro], sections: help(l).steps.map((s) => ({ heading: s.title, paragraphs: [s.text] })), note: [help(l).guideNote] }) });
  const privacy = (l: "ja" | "en") => ({
    title: policy(l).title,
    body: writePageBody({
      lead: [policy(l).updated],
      sections: policy(l).sections.map((s) => ({ heading: s.heading, paragraphs: [...(s.paragraphs ?? []), ...(s.items ?? []).map((i) => `${i.term}：${i.text}`)] })),
      note: [],
    }),
  });
  const terms = { title: termsContent.title, body: writePageBody({ lead: [termsContent.lead, termsContent.intro, `更新日：${termsContent.updated}`], sections: termsContent.sections, note: [] }) };
  // The terms are written in Japanese only; the English box starts empty (the English page shows the Japanese text and says so).
  return { faq: { ja: faq("ja"), en: faq("en") }, guide: { ja: guide("ja"), en: guide("en") }, privacy: { ja: privacy("ja"), en: privacy("en") }, terms: { ja: terms, en: { title: "", body: "" } } };
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

/** A published page made in the admin (/p/<slug>), or null. */
export async function customPage(slug: string): Promise<CustomPage | null> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/site-pages/${encodeURIComponent(slug)}`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; page?: CustomPage | null } | null;
    return res.ok && json?.ok === true ? (json.page ?? null) : null;
  } catch {
    return null;
  }
}

/** The published pages made in the admin, oldest first, for links to them. */
export async function customPages(): Promise<CustomPage[]> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/site-pages`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; pages?: CustomPage[] } | null;
    return res.ok && json?.ok === true ? (json.pages ?? []) : [];
  } catch {
    return [];
  }
}

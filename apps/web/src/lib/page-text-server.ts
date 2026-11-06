import { helpContent, type Help } from "./help-content";
import { helpWith, ownText, policyWith, termsWith, type CustomPage, type OwnText, type Terms } from "./page-content";
import { homeTextIn, type HomeText } from "./home-text";
import { writePageBody, type PageKey, type PageText } from "./page-text";
import { privacyPolicy, type Policy } from "./privacy-content";
import { termsContent } from "./terms-content";

// Server side: reads a fixed page's own text for page-content.ts. An API that cannot be reached shows the built-in page.

async function savedPage(key: PageKey): Promise<PageText | null> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/pages/${key}`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; page?: PageText | null } | null;
    return res.ok && json?.ok === true ? (json.page ?? null) : null;
  } catch {
    return null;
  }
}

async function own(key: PageKey, locale: string): Promise<OwnText> {
  return ownText(await savedPage(key), locale, key === "guide");
}

/** What the editor wrote in place of the home page's words. */
export async function homeTextFor(locale: string): Promise<HomeText> {
  return homeTextIn(await savedPage("home"), locale);
}

/** The how-to-play page and the FAQ (and their titles), with the editor's text where there is some. */
export async function helpFor(locale: string): Promise<Help> {
  const [guide, faq] = await Promise.all([own("guide", locale), own("faq", locale)]);
  return helpWith(locale, guide, faq);
}

export async function policyFor(locale: string): Promise<Policy> {
  return policyWith(locale, await own("privacy", locale));
}

export async function termsFor(locale: string): Promise<Terms> {
  return termsWith(await own("terms", locale));
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
  return { home: { ja: { title: "", body: "" }, en: { title: "", body: "" } }, faq: { ja: faq("ja"), en: faq("en") }, guide: { ja: guide("ja"), en: guide("en") }, privacy: { ja: privacy("ja"), en: privacy("en") }, terms: { ja: terms, en: { title: "", body: "" } } };
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

export { customPageIn, type CustomPage, type Terms } from "./page-content";

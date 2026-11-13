import { photoLinkLooksValid } from "./admin/save-plan";
import type { PageText } from "./page-text";

// The words of the home page an editor can replace (管理 > ページ > ホーム). The page's layout, its buttons and the
// numbers stay in the app. Each language's words are kept as JSON in the fixed page's body, so a box left empty shows the
// app's own words for that box only. Pure functions; tests are in home-text.test.ts.

export const HOME_SLOTS = [
  "heroLine",
  "rallyHeading",
  "rallyLead",
  "rallyText",
  "routesHeading",
  "mapHeading",
  "storyHeading",
  "storyText",
  "storyCaption",
  "videoHeading",
  "officialHeading",
  "tourismHeading",
  "beforeHeading",
  "before1",
  "before2",
  "before3",
  "beforeNotice",
  "startHeading",
] as const;
export type HomeSlot = (typeof HOME_SLOTS)[number];
/** The desktop's picture panel, one photo for the ridge chapter and one for the rally chapter (the sea is the banner photos). */
export const HOME_PHOTO_SLOTS = ["photoRidge", "photoRally"] as const;
export type HomePhotoSlot = (typeof HOME_PHOTO_SLOTS)[number];
export type HomeText = Partial<Record<HomeSlot | HomePhotoSlot, string>>;

/** The words as typed (spaces kept, for the editor); anything that is not a known box is dropped. */
export function parseHomeText(body: string): HomeText {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null) return {};
  const text: HomeText = {};
  for (const slot of [...HOME_SLOTS, ...HOME_PHOTO_SLOTS]) {
    const value = (raw as Record<string, unknown>)[slot];
    if (typeof value === "string" && value !== "") text[slot] = value;
  }
  return text;
}

export function writeHomeText(text: HomeText): string {
  return Object.keys(text).length === 0 ? "" : JSON.stringify(text);
}

/** What the visitor's language has of its own: boxes with only spaces in them show the app's words. */
export function homeTextIn(page: PageText | null | undefined, locale: string): HomeText {
  const typed = parseHomeText(page?.[locale === "ja" ? "ja" : "en"].body ?? "");
  return Object.fromEntries(Object.entries(typed).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, v.trim()]));
}

/** The chapter photos a visitor sees: the https link in their language, else the Japanese one, else null (the app's own photo). */
export function homePhotosIn(page: PageText | null | undefined, locale: string): (string | null)[] {
  const own = parseHomeText(page?.[locale === "ja" ? "ja" : "en"].body ?? "");
  const ja = parseHomeText(page?.ja.body ?? "");
  return HOME_PHOTO_SLOTS.map((slot) => {
    const link = (own[slot] ?? ja[slot] ?? "").trim();
    return link !== "" && photoLinkLooksValid(link) ? link : null;
  });
}

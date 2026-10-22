import { fetchPublicBanners } from "./api-content";

// The photos for the banner carousel at the top of the home page. They are added in the admin (/admin/banners):
// a photo the project may use (about 1600 x 1000) and a short description in Japanese and English, read out by
// screen readers. With none the carousel is left out (in development it shows grey placeholders so the layout can
// be seen). Server code only (it fetches from the API).
export interface BannerSlide {
  /** An https link to the photo; null draws a placeholder. */
  src: string | null;
  /** Who took the photo / where it is from, shown on it (may hold links). */
  credit?: string | null;
  altJa: string;
  altEn: string;
}

/** The published banners, in order; none when the API does not answer (the carousel is then left out). */
export async function listBanners(): Promise<BannerSlide[]> {
  return ((await fetchPublicBanners()) ?? []).map((b) => ({ src: b.imageUrl, credit: b.imageCredit ?? null, altJa: b.altJa, altEn: b.altEn ?? b.altJa }));
}

/** What the carousel shows: the real slides, or three placeholders while developing with sample content. */
export function slidesToShow(slides: readonly BannerSlide[], sample: boolean): BannerSlide[] {
  if (slides.length > 0) return [...slides];
  return sample ? Array.from({ length: 3 }, () => ({ src: null, altJa: "写真（準備中）", altEn: "Photo (coming soon)" })) : [];
}

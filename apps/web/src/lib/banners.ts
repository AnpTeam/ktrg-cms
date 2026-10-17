// The photos for the banner carousel at the top of the signed-out home page. To add one: put the image in
// apps/web/public/banners/ (about 1600 x 1000, under 300 KB, a photo the project has permission to use) and add a
// row here with a short description in Japanese and English (read out by screen readers).
// With no rows the carousel is left out (in development it shows grey placeholders so the layout can be seen).
export interface BannerSlide {
  /** A path under /banners, for example "/banners/01.jpg"; null draws a placeholder. */
  src: string | null;
  altJa: string;
  altEn: string;
}

export const bannerSlides: BannerSlide[] = [];

/** What the carousel shows: the real slides, or three placeholders while developing with sample content. */
export function slidesToShow(slides: readonly BannerSlide[], sample: boolean): BannerSlide[] {
  if (slides.length > 0) return [...slides];
  return sample ? Array.from({ length: 3 }, () => ({ src: null, altJa: "写真（準備中）", altEn: "Photo (coming soon)" })) : [];
}

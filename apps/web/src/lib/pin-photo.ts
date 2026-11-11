import type { MapPhoto } from "./map-screen";

/**
 * The photo a map pin draws in its head: the stop's own photo, and only when its address is safe to put in the page,
 * an https link (uploads) or one of our own files. Anything else (no photo, blanks, a data: or javascript: link, plain
 * http) gives null and the pin keeps its number head.
 */
export function pinPhotoSrc(photo: MapPhoto | null | undefined): string | null {
  const src = photo?.src.trim();
  if (!src) return null;
  if (src.startsWith("https://") || (src.startsWith("/") && !src.startsWith("//"))) return src;
  return null;
}

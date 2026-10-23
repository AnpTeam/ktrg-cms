// What the photo library picker does with its list, in the browser: search by name, sort by date, name or size, and say a
// size in plain units. Pure, so it is tested without a browser.

export interface LibraryPhoto {
  key: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export type SortKey = "date" | "name" | "size";
export type SortDir = "asc" | "desc";

/** The file's own name, without the folder and the random ending the API adds ("photos/kada-k3f9q2.jpg" -> "kada.jpg"). */
export const fileName = (key: string): string => key.replace(/^photos\//, "").replace(/-[a-z2-9]{6}(\.[a-z]+)$/i, "$1");

/** Photos whose name has every word of the search in it (any case; full and half width letters match each other). */
export function filterPhotos(photos: readonly LibraryPhoto[], query: string): LibraryPhoto[] {
  const words = query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...photos];
  return photos.filter((p) => {
    const name = fileName(p.key).normalize("NFKC").toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

/** A sorted copy. Names sort the way a person reads them (numbers by value, Japanese by its own order); ties keep the newest first. */
export function sortPhotos(photos: readonly LibraryPhoto[], key: SortKey, dir: SortDir): LibraryPhoto[] {
  const by = (a: LibraryPhoto, b: LibraryPhoto) =>
    key === "name" ? fileName(a.key).localeCompare(fileName(b.key), "ja", { numeric: true }) : key === "size" ? a.size - b.size : Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt);
  const sign = dir === "asc" ? 1 : -1;
  return [...photos].sort((a, b) => sign * by(a, b) || Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
}

/** "850 KB", "1.2 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

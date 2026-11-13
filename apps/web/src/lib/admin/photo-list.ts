// The photos of a waypoint as the editor shows them: one list, the first being the main photo. The database keeps the main
// photo (url, credit, source page) and the gallery apart; these functions turn one into the other and nothing else, so the
// editor can add, move, remove and pick the main photo with plain list operations.

export type ListPhoto = { url: string; credit: string | null; sourceUrl: string | null };
export type StoredPhotos = { photoUrl: string; photoCredit: string; photoSourceUrl: string; photos: ListPhoto[] };

export const MAX_PHOTOS = 12;

export function toList(s: StoredPhotos): ListPhoto[] {
  const main: ListPhoto[] = s.photoUrl.trim() ? [{ url: s.photoUrl, credit: s.photoCredit.trim() || null, sourceUrl: s.photoSourceUrl.trim() || null }] : [];
  return [...main, ...s.photos.filter((p) => p.url !== s.photoUrl)];
}

export function fromList(list: readonly ListPhoto[]): StoredPhotos {
  const [main, ...rest] = list;
  return { photoUrl: main?.url ?? "", photoCredit: main?.credit ?? "", photoSourceUrl: main?.sourceUrl ?? "", photos: rest };
}

/** At the end (so the first photo added is the main one); the same photo twice, or past the limit, changes nothing. */
export function addPhoto(list: readonly ListPhoto[], photo: ListPhoto): ListPhoto[] {
  if (list.length >= MAX_PHOTOS || list.some((p) => p.url === photo.url)) return [...list];
  return [...list, photo];
}

/** One photo to the front; the others keep their order (the old main photo is now second). */
export function makeMain(list: readonly ListPhoto[], index: number): ListPhoto[] {
  const one = list[index];
  return one ? [one, ...list.filter((_, i) => i !== index)] : [...list];
}

/** Swaps the photo with its neighbour; at either end nothing moves. Reaching the top makes it the main photo. */
export function movePhoto(list: readonly ListPhoto[], index: number, step: -1 | 1): ListPhoto[] {
  const to = index + step;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}

export const removePhoto = (list: readonly ListPhoto[], index: number): ListPhoto[] => list.filter((_, i) => i !== index);

export function patchPhoto(list: readonly ListPhoto[], index: number, change: Partial<Pick<ListPhoto, "credit" | "sourceUrl">>): ListPhoto[] {
  const clean = (v: string | null | undefined) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v);
  return list.map((p, i) => (i === index ? { ...p, ...(change.credit !== undefined ? { credit: clean(change.credit) ?? null } : {}), ...(change.sourceUrl !== undefined ? { sourceUrl: clean(change.sourceUrl) ?? null } : {}) } : p));
}

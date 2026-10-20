// Finding a place by name for the map editor ("Sainen-ji", "友ヶ島"), the way Navivi's location search does it: OpenStreetMap's
// Nominatim, which needs no key and knows small shrines, passes and trails. Used to move the map, never to fill in a place's
// position (a position is checked by a person against a named source).

export interface PlaceHit {
  name: string;
  lat: number;
  lng: number;
}

/** Nominatim asks for at most one request a second and a page that names itself; the editor sends one per search. */
export const searchUrl = (query: string) =>
  `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(query.trim())}`;

/** The hits Nominatim sent, without anything that has no usable position. */
export function readHits(data: unknown): PlaceHit[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((h: { display_name?: unknown; lat?: unknown; lon?: unknown }) => {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    return typeof h.display_name === "string" && Number.isFinite(lat) && Number.isFinite(lng) ? [{ name: h.display_name, lat, lng }] : [];
  });
}

/** null when the service could not be reached (the editor says so); an empty list means nothing was found. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceHit[] | null> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(searchUrl(query), { signal });
    return res.ok ? readHits(await res.json()) : null;
  } catch {
    return null;
  }
}

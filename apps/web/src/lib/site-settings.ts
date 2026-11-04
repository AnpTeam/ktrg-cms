import { defaultMapSettings, sanitizeMapSettings, type MapSettings } from "./map-settings";

// Server side: the settings an admin chose for the whole site (管理 > サイト全体の設定), read from the API for every page
// view. Until one is saved, or when the API cannot be reached, the built-in default applies, so a map never fails to appear.

type PublicSettings = { ok?: unknown; mapStyle?: unknown; homeSections?: { tourism?: unknown } | null };

async function readSettings(): Promise<PublicSettings | null> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/settings`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) });
    const body = (await res.json().catch(() => null)) as PublicSettings | null;
    return res.ok && body?.ok === true ? body : null;
  } catch {
    return null;
  }
}

export async function getMapSettings(): Promise<MapSettings> {
  const body = await readSettings();
  return body?.mapStyle ? sanitizeMapSettings(body.mapStyle) : defaultMapSettings;
}

/** The optional home page sections an admin switched on. Everything is off when nothing was saved or the API cannot be reached. */
export async function getHomeSections(): Promise<{ tourism: boolean }> {
  const body = await readSettings();
  return { tourism: body?.homeSections?.tourism === true };
}

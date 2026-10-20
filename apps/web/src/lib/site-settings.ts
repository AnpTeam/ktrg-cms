import { defaultMapSettings, sanitizeMapSettings, type MapSettings } from "./map-settings";

// Server side: the settings an admin chose for the whole site (管理 > サイト全体の設定), read from the API for every page
// view. Until one is saved, or when the API cannot be reached, the built-in default applies, so a map never fails to appear.

export async function getMapSettings(): Promise<MapSettings> {
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/settings`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    const body = (await res.json().catch(() => null)) as { ok?: unknown; mapStyle?: unknown } | null;
    return res.ok && body?.ok === true && body.mapStyle ? sanitizeMapSettings(body.mapStyle) : defaultMapSettings;
  } catch {
    return defaultMapSettings;
  }
}

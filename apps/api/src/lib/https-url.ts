/** A photo or source address: an https link, not absurdly long. */
export const isHttpsUrl = (v: string): boolean => {
  if (v.length > 500) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** A photo address: an https link, not absurdly long, and (when `hosts` is set) on one of those hosts (PHOTO_HOSTS). */
export const isPhotoUrl = (v: string, hosts: readonly string[]): boolean => {
  if (v.length > 500) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && (hosts.length === 0 || hosts.includes(url.hostname));
  } catch {
    return false;
  }
};

/**
 * The host names a photo link may use. PHOTO_HOSTS wins. In production without it, only the photo bucket's own host
 * (R2_PUBLIC_URL), so an editor cannot point visitors' browsers at a stranger's server. Empty means any https host:
 * development, or production with neither set (the startup warns about that).
 */
export function photoHostsFor(o: { photoHosts?: string; r2PublicUrl?: string; production: boolean }): readonly string[] {
  const listed = o.photoHosts?.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) ?? [];
  if (listed.length > 0 || !o.production || !o.r2PublicUrl) return listed;
  return [new URL(o.r2PublicUrl).hostname]; // R2_PUBLIC_URL is checked as an https address at startup (parse-env)
}

/** Wikimedia Commons serves the photos the editor's photo finder picks; always allowed when photo hosts are restricted. */
const WIKIMEDIA_HOSTS = ["upload.wikimedia.org"];

/** The photo hosts plus Wikimedia's; no hosts (unrestricted) stays unrestricted. */
export const withWikimedia = (hosts: readonly string[]): readonly string[] => (hosts.length === 0 ? hosts : [...new Set([...hosts, ...WIKIMEDIA_HOSTS])]);

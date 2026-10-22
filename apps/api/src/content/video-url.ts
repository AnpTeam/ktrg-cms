// Same rule as the web app's lib/video.ts: only https links on YouTube or Vimeo hosts are kept.
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;

/** An uploaded video file (see POST /admin/uploads/video): an https link to an .mp4 or .webm, on one of `hosts` (PHOTO_HOSTS) when set. */
export const isVideoFileUrl = (url: URL, hosts: readonly string[]): boolean =>
  url.protocol === "https:" && /\.(mp4|webm)$/i.test(url.pathname) && (hosts.length === 0 || hosts.includes(url.hostname.toLowerCase()));

export function isAllowedVideoUrl(raw: string, photoHosts: readonly string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (isVideoFileUrl(url, photoHosts)) return true;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  if (YOUTUBE_HOSTS.has(host)) {
    const id = host === "youtu.be" ? parts[0] : parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : url.searchParams.get("v");
    return !!id && YOUTUBE_ID.test(id);
  }
  if (VIMEO_HOSTS.has(host)) return parts.some((p) => VIMEO_ID.test(p));
  return false;
}

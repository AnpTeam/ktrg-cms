// Video links are accepted from YouTube and Vimeo only (CLAUDE.md, "Video URLs"), checked here before anything
// is rendered as an embed. Pure, so it can be tested and used by server and browser code alike.

export interface EmbedVideo {
  provider: "youtube" | "vimeo";
  id: string;
  embedUrl: string;
  /** The normal page for the video, offered as a plain link when the embed cannot load. */
  watchUrl: string;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;

export function parseVideoUrl(raw: string | null | undefined): EmbedVideo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    const id = host === "youtu.be" ? parts[0] : parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : url.searchParams.get("v");
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = parts.find((p) => VIMEO_ID.test(p));
    if (!id) return null;
    return { provider: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}`, watchUrl: `https://vimeo.com/${id}` };
  }
  return null;
}

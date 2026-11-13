// Video links are accepted from YouTube only (CLAUDE.md, "Video URLs"; an uploaded video file is the other way, see below), checked here before anything
// is rendered as an embed. Pure, so it can be tested and used by server and browser code alike.

export interface EmbedVideo {
  provider: "youtube";
  id: string;
  embedUrl: string;
  /** The normal page for the video, offered as a plain link when the embed cannot load. */
  watchUrl: string;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const YOUTUBE_ID = /^[\w-]{11}$/;

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
  return null;
}

/** A video file uploaded to the site's own storage (an https link to an .mp4 or .webm), played with the browser's own player. */
export interface FileVideo {
  src: string;
}

/**
 * Where the page loads the subtitles of an uploaded video from: the site's own address, which reads the .vtt beside the video from
 * the storage (so neither the video nor the subtitles need the storage to allow another site's browser). Sending subtitles again
 * replaces the file under the same name, so `version` (the route's last save time) is part of the address: a cache never keeps
 * showing the old file.
 */
export const subtitleUrl = (video: FileVideo, version?: string | null): string =>
  `/api/v1/subtitles?video=${encodeURIComponent(video.src)}${version ? `&v=${encodeURIComponent(version)}` : ""}`;

export function parseVideoFile(raw: string | null | undefined): FileVideo | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" && /\.(mp4|webm)$/i.test(url.pathname) ? { src: url.toString() } : null;
  } catch {
    return null;
  }
}

// The council's own promotional video, shown until the deployment sets INTRO_VIDEO_URL.
const OFFICIAL_PR_VIDEO = "https://www.youtube.com/watch?v=fd-i0SqyhP0";

/** The home page's video: set by the deployment (a YouTube link). Server side, for the environment. */
export const homeIntroVideo = () => parseVideoUrl(process.env.INTRO_VIDEO_URL ?? OFFICIAL_PR_VIDEO);

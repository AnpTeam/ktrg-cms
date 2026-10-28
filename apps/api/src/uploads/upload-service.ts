import { randomUUID } from "node:crypto";
import type { FileStorage } from "./upload-storage";

/**
 * Below Vercel's 4.5 MB request limit (the multipart wrapping adds a little), so a photo that
 * passes here is never cut off by the platform first.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The kinds of file accepted: photos for routes and places. */
const IMAGE_TYPES = [
  { type: "image/jpeg", ext: "jpg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    matches: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    type: "image/webp",
    ext: "webp",
    matches: (b: Uint8Array) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
] as const;

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

/** What the file really is, from its first bytes. The name and type the browser sends are not trusted. */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const found = IMAGE_TYPES.find((t) => t.matches(bytes));
  return found ? { type: found.type, ext: found.ext } : null;
}

/**
 * A readable key from the uploaded file's name: `photos/<name>-<6 random letters>.<ext>`.
 * Letters (Japanese too), digits, "-" and "_" are kept, spaces become "-", anything else is dropped,
 * and the name is cut to 60 characters. The random ending means two files with the same name
 * never overwrite each other. The extension comes from the bytes, not from the name.
 */
export function photoKey(fileName: string, ext: string, random: () => string = randomSuffix, folder = "photos"): string {
  const stem = fileName.normalize("NFC").replace(/\.[^.]*$/, "");
  const clean = stem
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 60);
  return `${folder}/${clean || "photo"}-${random()}.${ext}`;
}

function randomSuffix(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o or 1/l, easy to read back
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
}

/** The public address of a key; each path part is percent-encoded (Japanese names work in every browser). */
function publicUrl(base: string, key: string): string {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Videos go straight from the browser to storage, so the API only signs the address; this is the most it signs. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** The video kinds accepted: what a phone or a export from an editor makes, and what every browser plays. */
const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm" } as const;

export interface Upload {
  /** A new UUID: the audit target (the audit log keeps ids only, never file names). */
  id: string;
  /** Where the file is in the bucket, e.g. photos/0-Start-寺田バス停-k3f9q2.jpg */
  key: string;
  /** The public https address to save as a route or place photo. */
  url: string;
  contentType: string;
  size: number;
}

/** One photo already in the library. */
export interface LibraryPhoto {
  key: string;
  url: string;
  size: number;
  uploadedAt: string;
}

/** The most photos the library lists, newest first. */
export const LIBRARY_LIMIT = 1000;

/** How many files are read from the bucket before sorting: the bucket lists by name, so the newest are only known after reading them all. */
const LIBRARY_SCAN_LIMIT = 5000;
const LIBRARY_CACHE_MS = 60_000;

/** A subtitle file is small text; this is the most it signs. */
export const MAX_SUBTITLE_BYTES = 1024 * 1024;

/**
 * The key of the subtitles that belong to a video: the video's own key with ".vtt" in place of its extension, so the player
 * finds them without anything saved on the route. null when the address is not one of our videos.
 */
export function subtitleKeyFor(videoUrl: string, base: string): string | null {
  if (!videoUrl.startsWith(`${base}/`)) return null;
  try {
    const path = decodeURIComponent(new URL(videoUrl).pathname.replace(/^\//, ""));
    return /^videos\/[^/]+\.(mp4|webm)$/i.test(path) ? path.replace(/\.[^.]+$/, ".vtt") : null;
  } catch {
    return null;
  }
}

export interface VideoUpload {
  id: string;
  key: string;
  /** The public https address to save as the route's video link, once the file is in. */
  url: string;
  /** Where the browser PUTs the file (with the same Content-Type and length), within 15 minutes. */
  uploadUrl: string;
}

export type SubtitleUploadResult =
  | { ok: true; upload: { id: string; url: string; uploadUrl: string } }
  | { ok: false; reason: "invalid_file" | "uploads_unavailable" };

export type VideoUploadResult =
  | { ok: true; upload: VideoUpload }
  | { ok: false; reason: "invalid_file" | "uploads_unavailable" };

export type UploadResult =
  | { ok: true; upload: Upload }
  | { ok: false; reason: "invalid_file" | "uploads_unavailable" };

export type UploadService = ReturnType<typeof createUploadService>;

/**
 * Photo uploads. Without storage configured (no R2 settings) every upload answers
 * `uploads_unavailable`, so the rest of the app runs without it.
 *
 * - Only JPEG, PNG and WebP, checked from the file's bytes, at most MAX_UPLOAD_BYTES.
 * - Stored under a readable key from the file's name (photoKey), cleaned of odd characters,
 *   with a random ending so two uploads never overwrite each other. Admins upload trail photos;
 *   the name stays out of the audit log and the error log.
 */
export function createUploadService(deps: {
  storage?: FileStorage;
  /** Where the bucket is public, e.g. https://photos.example.com (no trailing slash). */
  publicBaseUrl?: string;
  log?: (message: string) => void;
  now?: () => number;
  /** How a stored file is read back (tests give their own). */
  fetcher?: typeof fetch;
}) {
  const log = deps.log ?? console.error;
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  // The library list is kept for a minute (and dropped after an upload): opening it reads the bucket, which costs time and money.
  let cached: { at: number; photos: LibraryPhoto[] } | null = null;
  return {
    /** Every photo uploaded so far, newest first, so an editor can pick one again instead of uploading it twice. */
    async listPhotos(): Promise<{ ok: true; photos: LibraryPhoto[] } | { ok: false; reason: "uploads_unavailable" }> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      if (cached && now() - cached.at < LIBRARY_CACHE_MS) return { ok: true, photos: cached.photos };
      try {
        const files = await deps.storage.list("photos/", LIBRARY_SCAN_LIMIT);
        const photos = files
          .filter((f) => f.size > 0 && /\.(jpe?g|png|webp)$/i.test(f.key))
          .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
          .slice(0, LIBRARY_LIMIT)
          .map((f) => ({ key: f.key, url: publicUrl(deps.publicBaseUrl!, f.key), size: f.size, uploadedAt: f.lastModified.toISOString() }));
        cached = { at: now(), photos };
        return { ok: true, photos };
      } catch (err) {
        log(`listing the photo storage failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
      }
    },
    /** Signs an upload address for one video. The file's bytes are not seen here; the browser checks them before sending. */
    async createVideoUpload(file: { name: string; contentType: string; size: number }): Promise<VideoUploadResult> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      const ext = (VIDEO_TYPES as Record<string, string | undefined>)[file.contentType];
      if (!ext || !Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_VIDEO_BYTES) return { ok: false, reason: "invalid_file" };
      const key = photoKey(file.name, ext, undefined, "videos");
      try {
        const uploadUrl = await deps.storage.presignPut(key, file.contentType, file.size);
        return { ok: true, upload: { id: randomUUID(), key, url: publicUrl(deps.publicBaseUrl, key), uploadUrl } };
      } catch (err) {
        log(`signing a video upload failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
      }
    },
    /** Signs an upload address for the subtitles (WebVTT text) of one of our videos; they sit beside it under the same name. */
    async createSubtitleUpload(file: { videoUrl: string; size: number }): Promise<SubtitleUploadResult> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      const key = subtitleKeyFor(file.videoUrl, deps.publicBaseUrl);
      if (!key || !Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_SUBTITLE_BYTES) return { ok: false, reason: "invalid_file" };
      try {
        const uploadUrl = await deps.storage.presignPut(key, "text/vtt", file.size);
        return { ok: true, upload: { id: randomUUID(), url: publicUrl(deps.publicBaseUrl, key), uploadUrl } };
      } catch (err) {
        log(`signing a subtitle upload failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
      }
    },
    /**
     * The subtitles (WebVTT text) that sit beside one of our videos, read from the bucket here so the page can load them from its
     * own address: a browser fetches a subtitle file from another site only with CORS set up on both sides, and the video would
     * then depend on it too. null when the address is not one of our videos, there are no subtitles, or the file is not small text.
     */
    async readSubtitles(videoUrl: string): Promise<string | null> {
      if (!deps.publicBaseUrl) return null;
      const key = subtitleKeyFor(videoUrl, deps.publicBaseUrl);
      if (!key) return null;
      try {
        const res = await fetcher(publicUrl(deps.publicBaseUrl, key), { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const text = await res.text();
        return text.length > 0 && text.length <= MAX_SUBTITLE_BYTES && text.trimStart().startsWith("WEBVTT") ? text : null;
      } catch (err) {
        log(`reading subtitles failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    },
    async uploadPhoto(file: Blob): Promise<UploadResult> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "invalid_file" };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const image = sniffImage(bytes);
      if (!image) return { ok: false, reason: "invalid_file" };

      const id = randomUUID();
      const key = photoKey(file instanceof File ? file.name : "", image.ext);
      try {
        await deps.storage.put(key, bytes, image.type);
      } catch (err) {
        // The storage error, not the file: no names or contents in the log.
        log(`upload to storage failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
      }
      cached = null; // the new photo shows up in the library at once
      return {
        ok: true,
        upload: { id, key, url: publicUrl(deps.publicBaseUrl, key), contentType: image.type, size: bytes.length },
      };
    },
  };
}

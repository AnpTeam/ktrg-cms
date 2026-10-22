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
export function photoKey(fileName: string, ext: string, random: () => string = randomSuffix): string {
  const stem = fileName.normalize("NFC").replace(/\.[^.]*$/, "");
  const clean = stem
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 60);
  return `photos/${clean || "photo"}-${random()}.${ext}`;
}

function randomSuffix(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o or 1/l, easy to read back
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
}

/** The public address of a key; each path part is percent-encoded (Japanese names work in every browser). */
function publicUrl(base: string, key: string): string {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

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

/** The most photos the library lists (the newest first); the photo bucket is small, so one page. */
export const LIBRARY_LIMIT = 1000;

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
}) {
  const log = deps.log ?? console.error;
  return {
    /** Every photo uploaded so far, newest first, so an editor can pick one again instead of uploading it twice. */
    async listPhotos(): Promise<{ ok: true; photos: LibraryPhoto[] } | { ok: false; reason: "uploads_unavailable" }> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      try {
        const files = await deps.storage.list("photos/", LIBRARY_LIMIT);
        const photos = files
          .filter((f) => f.size > 0 && /\.(jpe?g|png|webp)$/i.test(f.key))
          .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
          .map((f) => ({ key: f.key, url: publicUrl(deps.publicBaseUrl!, f.key), size: f.size, uploadedAt: f.lastModified.toISOString() }));
        return { ok: true, photos };
      } catch (err) {
        log(`listing the photo storage failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
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
      return {
        ok: true,
        upload: { id, key, url: publicUrl(deps.publicBaseUrl, key), contentType: image.type, size: bytes.length },
      };
    },
  };
}

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

export interface Upload {
  /** A new UUID: the file's key in storage and the audit target. */
  id: string;
  /** The public https address to save as a route or place photo. */
  url: string;
  contentType: string;
  size: number;
}

export type UploadResult =
  | { ok: true; upload: Upload }
  | { ok: false; reason: "invalid_file" | "uploads_unavailable" };

export type UploadService = ReturnType<typeof createUploadService>;

/**
 * Photo uploads. Without storage configured (no R2 settings) every upload answers
 * `uploads_unavailable`, so the rest of the app runs without it.
 *
 * - Only JPEG, PNG and WebP, checked from the file's bytes, at most MAX_UPLOAD_BYTES.
 * - Stored under `photos/<uuid>.<ext>`: the visitor's file name is never used (it may hold
 *   a person's name or odd characters), and two uploads never overwrite each other.
 */
export function createUploadService(deps: {
  storage?: FileStorage;
  /** Where the bucket is public, e.g. https://photos.example.com (no trailing slash). */
  publicBaseUrl?: string;
  log?: (message: string) => void;
}) {
  const log = deps.log ?? console.error;
  return {
    async uploadPhoto(file: Blob): Promise<UploadResult> {
      if (!deps.storage || !deps.publicBaseUrl) return { ok: false, reason: "uploads_unavailable" };
      if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "invalid_file" };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const image = sniffImage(bytes);
      if (!image) return { ok: false, reason: "invalid_file" };

      const id = randomUUID();
      const key = `photos/${id}.${image.ext}`;
      try {
        await deps.storage.put(key, bytes, image.type);
      } catch (err) {
        // The storage error, not the file: no names or contents in the log.
        log(`upload to storage failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "uploads_unavailable" };
      }
      return { ok: true, upload: { id, url: `${deps.publicBaseUrl}/${key}`, contentType: image.type, size: bytes.length } };
    },
  };
}

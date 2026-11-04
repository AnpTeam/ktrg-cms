import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/** Where uploaded files are kept: Cloudflare R2, or a folder on the server's disk; tests use the memory copy. */
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /**
   * A short-lived address the browser can PUT one file to directly (a video is too big to pass through the API). The
   * content type and the exact length are part of the signature, so only that file can be sent.
   */
  presignPut(key: string, contentType: string, size: number): Promise<string>;
  /** The files under a key prefix (at most `limit`), in no particular order. */
  list(prefix: string, limit: number): Promise<StoredFile[]>;
  /** A small stored file's text, or null when there is none. Only storages that can read without HTTP have it. */
  readText?(key: string): Promise<string | null>;
}

export interface StoredFile {
  key: string;
  size: number;
  lastModified: Date;
}

/** How long a signed upload address works: long enough to start a big upload on a slow line. */
const PRESIGN_SECONDS = 15 * 60;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Cloudflare R2 through its S3-compatible API. The AWS SDK, not Bun's own S3 client, so it also
 * runs on Vercel's Node runtime. Nothing connects until the first upload.
 */
export function createR2Storage(config: R2Config): FileStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Newer SDKs put a checksum of an EMPTY body into a presigned address, so the browser's real upload never matches it.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // The key is a fresh UUID, so the file at an address never changes: cache it for good.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async presignPut(key, contentType, size) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
          CacheControl: "public, max-age=31536000, immutable",
        }),
        // The type is signed too: the browser must send exactly this Content-Type, so a file cannot be stored as something else.
        { expiresIn: PRESIGN_SECONDS, signableHeaders: new Set(["content-type"]) },
      );
    },
    async list(prefix, limit) {
      const found: StoredFile[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, MaxKeys: Math.min(1000, limit - found.length), ContinuationToken: token }),
        );
        for (const o of page.Contents ?? []) {
          if (o.Key) found.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token && found.length < limit);
      return found;
    },
  };
}

/** The two folders a key may be in; anything else (or a path that climbs out with "..") is refused. */
const DISK_KEY = /^(photos|videos)\/[^/\\\0]+$/;

export type ReceiveResult = "ok" | "forbidden" | "wrong_size";

/** Disk storage also takes the browser's PUT to an address it signed (see receive). */
export interface DiskStorage extends FileStorage {
  /**
   * Stores the body of a PUT to an address presignPut made. "forbidden" when the signature, time or content type do not
   * match; "wrong_size" when the body is not exactly the signed length (nothing is kept then).
   */
  receive(key: string, query: Record<string, string | undefined>, contentType: string | undefined, body: ReadableStream<Uint8Array> | null): Promise<ReceiveResult>;
  readText(key: string): Promise<string | null>;
}

export interface DiskConfig {
  /** The folder files are kept in (a volume on the server's disk). */
  root: string;
  /** Where the browser sends a signed PUT, without the key: "/api/v1/uploads/direct" (same site, so no CORS). */
  uploadPath: string;
  /** Key for signing upload addresses. */
  secret: string;
  now?: () => number;
}

/**
 * Files in a folder on the server's own disk (EBS on AWS), served by the web server under the public address. A video is
 * still sent by the browser in one PUT to a signed, short-lived address, as with R2, but the address is this API's
 * (PUT /uploads/direct/<key>), which checks the signature, the type and the exact length before keeping anything.
 */
export function createDiskStorage(config: DiskConfig): DiskStorage {
  const root = resolve(config.root);
  const now = config.now ?? Date.now;
  const pathOf = (key: string): string | null => {
    if (!DISK_KEY.test(key) || key.split("/").some((p) => p === "." || p === "..")) return null;
    const path = resolve(root, key);
    return path.startsWith(root + sep) ? path : null;
  };
  const sign = (key: string, contentType: string, size: number, expires: number) =>
    createHmac("sha256", config.secret).update(`${key}\n${contentType}\n${size}\n${expires}`).digest("base64url");
  // Written beside the final name and renamed at the end, so a broken upload never shows at a public address.
  async function write(path: string, chunks: AsyncIterable<Uint8Array> | Uint8Array[], expected: number): Promise<boolean> {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.part-${randomBytes(6).toString("hex")}`;
    const file = await open(tmp, "wx");
    let written = 0;
    try {
      for await (const chunk of chunks) {
        written += chunk.length;
        if (written > expected) break;
        await file.write(chunk);
      }
    } catch (err) {
      // The browser went away mid-upload: drop the part file.
      await file.close();
      await rm(tmp, { force: true });
      throw err;
    }
    await file.close();
    if (written !== expected) {
      await rm(tmp, { force: true });
      return false;
    }
    await rename(tmp, path);
    return true;
  }
  return {
    async put(key, body) {
      const path = pathOf(key);
      if (!path) throw new Error("invalid storage key");
      await write(path, [body], body.length);
    },
    async presignPut(key, contentType, size) {
      if (!pathOf(key)) throw new Error("invalid storage key");
      const expires = Math.floor(now() / 1000) + PRESIGN_SECONDS;
      const query = new URLSearchParams({ type: contentType, size: String(size), expires: String(expires), sig: sign(key, contentType, size, expires) });
      return `${config.uploadPath}/${key.split("/").map(encodeURIComponent).join("/")}?${query}`;
    },
    async receive(key, query, contentType, body) {
      const path = pathOf(key);
      const size = Number(query.size);
      const expires = Number(query.expires);
      if (!path || !body || !query.type || !query.sig || !Number.isInteger(size) || size <= 0 || !Number.isInteger(expires)) return "forbidden";
      if (expires < Math.floor(now() / 1000) || contentType !== query.type) return "forbidden";
      const expected = Buffer.from(sign(key, query.type, size, expires));
      const given = Buffer.from(query.sig);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "forbidden";
      return (await write(path, body, size)) ? "ok" : "wrong_size";
    },
    async list(prefix, limit) {
      const found: StoredFile[] = [];
      const folder = prefix.replace(/\/+$/, "");
      if (folder !== "photos" && folder !== "videos") return found;
      let names: string[];
      try {
        names = await readdir(join(root, folder));
      } catch {
        return found; // nothing uploaded yet
      }
      for (const name of names) {
        if (found.length >= limit) break;
        if (name.includes(".part-")) continue;
        const s = await stat(join(root, folder, name)).catch(() => null);
        if (s?.isFile()) found.push({ key: `${folder}/${name}`, size: s.size, lastModified: s.mtime });
      }
      return found;
    },
    async readText(key) {
      const path = pathOf(key);
      if (!path) return null;
      return readFile(path, "utf8").catch(() => null);
    },
  };
}

/** In-memory storage for tests and the dev page. `fail` makes the next put throw once. */
export function createMemoryStorage() {
  const files = new Map<string, { body: Uint8Array; contentType: string; lastModified?: Date }>();
  const state = { fail: false };
  const storage: FileStorage = {
    async put(key, body, contentType) {
      if (state.fail) {
        state.fail = false;
        throw new Error("storage unavailable");
      }
      files.set(key, { body, contentType, lastModified: new Date() });
    },
    async presignPut(key) {
      if (state.fail) {
        state.fail = false;
        throw new Error("storage unavailable");
      }
      return `https://storage.example.com/${key}?signed=1`;
    },
    async list(prefix, limit) {
      if (state.fail) {
        state.fail = false;
        throw new Error("storage unavailable");
      }
      return [...files]
        .filter(([key]) => key.startsWith(prefix))
        .slice(0, limit)
        .map(([key, f]) => ({ key, size: f.body.length, lastModified: f.lastModified ?? new Date(0) }));
    },
  };
  return { storage, files, state };
}

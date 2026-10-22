import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Where uploaded files are kept. The app uses Cloudflare R2; tests use the memory copy. */
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** The files under a key prefix (at most `limit`), in no particular order. */
  list(prefix: string, limit: number): Promise<StoredFile[]>;
}

export interface StoredFile {
  key: string;
  size: number;
  lastModified: Date;
}

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

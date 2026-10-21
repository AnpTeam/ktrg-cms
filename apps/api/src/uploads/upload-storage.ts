import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Where uploaded files are kept. The app uses Cloudflare R2; tests use the memory copy. */
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

export interface R2Config {
  /** Cloudflare's account id; not needed when `endpoint` names another S3-compatible service. */
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Another S3-compatible service (Supabase Storage: https://<project>.storage.supabase.co/storage/v1/s3). */
  endpoint?: string;
  /** The service's region; "auto" for R2. */
  region?: string;
}

/**
 * Cloudflare R2, or any S3-compatible service such as Supabase Storage, through the S3 API. The AWS SDK, not Bun's own
 * S3 client, so it also runs on Vercel's Node runtime. Nothing connects until the first upload.
 */
export function createR2Storage(config: R2Config): FileStorage {
  const client = new S3Client({
    region: config.region ?? "auto",
    endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
    // Supabase (and most other services) address a bucket in the path, not as a sub-domain.
    forcePathStyle: config.endpoint !== undefined,
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
  };
}

/** In-memory storage for tests and the dev page. `fail` makes the next put throw once. */
export function createMemoryStorage() {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  const state = { fail: false };
  const storage: FileStorage = {
    async put(key, body, contentType) {
      if (state.fail) {
        state.fail = false;
        throw new Error("storage unavailable");
      }
      files.set(key, { body, contentType });
    },
  };
  return { storage, files, state };
}

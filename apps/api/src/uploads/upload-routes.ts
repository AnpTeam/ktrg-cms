import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, type UploadService } from "./upload-service";

export interface UploadServices extends KitServices {
  uploads: UploadService;
}

/**
 * Admin photo uploads to Cloudflare R2 (videos are too big for the host's request limit, so POST /video only signs an
 * address and the browser sends the file to R2 itself). The answer's `url` is what the editor saves as a route or
 * place photo (`photoUrl`). Send `multipart/form-data` with the image in the `file` field.
 */
export function uploadRoutes(getServices: () => UploadServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);

  return new Elysia({ prefix: "/admin/uploads", detail: { tags: ["Uploads"] } }).use(plugins)
    .get(
      "/",
      async ({ set }) => {
        const result = await getServices().uploads.listPhotos();
        return result.ok ? { ok: true as const, photos: result.photos } : fail(set, 503, "uploads_unavailable");
      },
      {
        auth: "upload.read",
        rateLimit: { adminLibraryUser: "user.id" },
        detail: { summary: "The photo library: every uploaded photo, newest first" },
      },
    )
    .post(
    "/",
    async ({ body, set }) => {
      const result = await getServices().uploads.uploadPhoto(body.file);
      if (result.ok) {
        set.status = 201;
        return { ok: true as const, upload: result.upload };
      }
      return result.reason === "invalid_file" ? fail(set, 400, "invalid_file") : fail(set, 503, "uploads_unavailable");
    },
    {
      auth: "upload.create",
      rateLimit: { adminUploadUser: "user.id" },
      audit: { action: "upload.create", target: "response:upload.id" },
      // The type and size are checked again from the bytes in the service; this only stops
      // something that is plainly not a file early.
      body: t.Object({ file: t.File({ maxSize: MAX_UPLOAD_BYTES }) }),
      detail: { summary: "Upload a photo (JPEG, PNG or WebP, up to 4 MB)" },
    },
  )
    .post(
      "/video",
      async ({ body, set }) => {
        const result = await getServices().uploads.createVideoUpload(body);
        if (result.ok) {
          set.status = 201;
          return { ok: true as const, upload: result.upload };
        }
        return result.reason === "invalid_file" ? fail(set, 400, "invalid_file") : fail(set, 503, "uploads_unavailable");
      },
      {
        auth: "upload.create",
        rateLimit: { adminVideoUser: "user.id" },
        audit: { action: "upload.create", target: "response:upload.id" },
        body: t.Object({
          name: t.String({ maxLength: 200 }),
          contentType: t.String({ maxLength: 100 }),
          size: t.Integer({ minimum: 1, maximum: MAX_VIDEO_BYTES }),
        }),
        detail: { summary: "Get a signed address to upload a video (MP4 or WebM, up to 200 MB) straight to storage" },
      },
    );
}

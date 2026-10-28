import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { MAX_SUBTITLE_BYTES, MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, type UploadService } from "./upload-service";

export interface UploadServices extends KitServices {
  uploads: UploadService;
}

/**
 * Public: the subtitles of an uploaded video, served from the site's own address (see readSubtitles). The page asks for them
 * with the video's address; anything that is not one of our videos' subtitles is a plain 404.
 */
export function subtitleRoutes(getServices: () => UploadServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ detail: { tags: ["Uploads"] } }).use(plugins).get(
    "/subtitles",
    async ({ query, set }) => {
      const text = await getServices().uploads.readSubtitles(query.video);
      if (text === null) return fail(set, 404, "not_found");
      set.headers["content-type"] = "text/vtt; charset=utf-8";
      // A few minutes: replaced subtitles show soon, and the site's cache answers most requests.
      set.headers["cache-control"] = "public, max-age=300, s-maxage=300";
      return text;
    },
    { rateLimit: { subtitleIp: "ip" }, query: t.Object({ video: t.String({ maxLength: 500 }), v: t.Optional(t.String({ maxLength: 100 })) }), detail: { summary: "The subtitles (WebVTT) of one of our uploaded videos" } },
  );
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
    )
    .post(
      "/subtitles",
      async ({ body, set }) => {
        const result = await getServices().uploads.createSubtitleUpload(body);
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
        body: t.Object({ videoUrl: t.String({ maxLength: 500 }), size: t.Integer({ minimum: 1, maximum: MAX_SUBTITLE_BYTES }) }),
        detail: { summary: "Get a signed address to upload the subtitles (WebVTT, up to 1 MB) of one of our videos" },
      },
    );
}

import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { MAX_UPLOAD_BYTES, type UploadService } from "./upload-service";

export interface UploadServices extends KitServices {
  uploads: UploadService;
}

/**
 * Admin photo uploads to Cloudflare R2. The answer's `url` is what the editor saves as a route or
 * place photo (`photoUrl`). Send `multipart/form-data` with the image in the `file` field.
 */
export function uploadRoutes(getServices: () => UploadServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);

  return new Elysia({ prefix: "/admin/uploads", detail: { tags: ["Uploads"] } }).use(plugins).post(
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
      rateLimit: { adminWriteUser: "user.id" },
      audit: { action: "upload.create", target: "response:upload.id" },
      // The type and size are checked again from the bytes in the service; this only stops
      // something that is plainly not a file early.
      body: t.Object({ file: t.File({ maxSize: MAX_UPLOAD_BYTES }) }),
      detail: { summary: "Upload a photo (JPEG, PNG or WebP, up to 4 MB)" },
    },
  );
}

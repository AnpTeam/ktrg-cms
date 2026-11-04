// Local / container entry: `bun run dev` or `bun run start`.
import { env } from "./env";
import { app } from "./app";
import { MAX_VIDEO_BYTES } from "./uploads/upload-service";

// Bun reads up to 128 MB of a request before the checks run; the largest real request is a 4 MB photo plus its form.
// With uploads on the server's disk a video (up to 200 MB) comes here too, so the limit is raised to that; the web server in
// front (Nginx, deploy/aws/nginx) keeps every other address at the small limit.
const maxRequestBodySize = env.UPLOADS_DIR && !env.R2_BUCKET_NAME ? MAX_VIDEO_BYTES + 1024 * 1024 : 6 * 1024 * 1024;
app.listen({ port: env.PORT, maxRequestBodySize });
console.log(`API listening on http://localhost:${env.PORT}/api/v1`);

// Local / container entry: `bun run dev` or `bun run start`.
import { env } from "./env";
import { app } from "./app";

// Bun reads up to 128 MB of a request before the checks run; the largest real request is a 4 MB photo plus its form.
app.listen({ port: env.PORT, maxRequestBodySize: 6 * 1024 * 1024 });
console.log(`API listening on http://localhost:${env.PORT}/api/v1`);

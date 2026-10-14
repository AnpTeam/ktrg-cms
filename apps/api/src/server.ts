// Local / container entry: `bun run dev` or `bun run start`.
import { env } from "./env";
import { app } from "./app";

app.listen(env.PORT);
console.log(`API listening on http://localhost:${env.PORT}/api/v1`);

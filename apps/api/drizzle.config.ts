import { defineConfig } from "drizzle-kit";

// Only used by drizzle-kit commands (generate / migrate), never at runtime.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});

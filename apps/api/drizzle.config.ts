import { defineConfig } from "drizzle-kit";
import { databaseUrlFrom } from "./src/parse-env";

// Only used by drizzle-kit commands (generate / migrate), never at runtime.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrlFrom(process.env) ?? "" },
});

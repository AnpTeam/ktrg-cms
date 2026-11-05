import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Builds the service worker (src/app/sw.ts) and serves it at /serwist/sw.js. Static: made once when the app is built.
// The revision versions the precached /offline page, so an old copy is replaced when the app changes (the commit, else a
// fresh id each build).
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});

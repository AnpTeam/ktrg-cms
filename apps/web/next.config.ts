import type { NextConfig } from "next";
import { linguiMacroSwcPlugin } from "@lingui/swc-plugin/options";
import { withSerwist } from "@serwist/turbopack";
import { buildCsp } from "./src/lib/csp";

// The Elysia API is proxied under /api/v1 so session cookies stay same-origin.
// Baked in at build time (standalone output): set API_ORIGIN when building.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const isProd = process.env.NODE_ENV === "production";

const csp = buildCsp({ isProd, r2UploadHost: process.env.R2_UPLOAD_HOST, r2PublicHost: process.env.R2_PUBLIC_HOST });

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
  // Only over https: browsers ignore it on plain http, and localhost must stay reachable.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone", // apps/web/Dockerfile copies .next/standalone
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Compiles the Lingui macros (Trans, msg, useLingui). The plugin version is
    // pinned exactly in package.json: it must match Next's SWC version.
    swcPlugins: [linguiMacroSwcPlugin()],
  },
  // .po catalogs are compiled on import by the Lingui loader.
  turbopack: {
    rules: {
      "*.po": { loaders: ["@lingui/loader"], as: "*.js" },
    },
  },
  webpack: (config) => {
    config.module.rules.push({ test: /\.po$/, use: { loader: "@lingui/loader" } });
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The stamp page became the rally page: old links and bookmarks arrive at /rallies with a proper redirect.
  async redirects() {
    return [{ source: "/stamps", destination: "/rallies", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default withSerwist(nextConfig);

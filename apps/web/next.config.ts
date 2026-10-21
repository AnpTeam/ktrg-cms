import type { NextConfig } from "next";
import { linguiMacroSwcPlugin } from "@lingui/swc-plugin/options";

// The Elysia API is proxied under /api/v1 so session cookies stay same-origin.
// Baked in at build time (standalone output): set API_ORIGIN when building.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const isProd = process.env.NODE_ENV === "production";

// Everything the pages load from outside: GSI map tiles, the admin's place search (Nominatim) and photo finder
// (Wikipedia / Wikimedia Commons), YouTube and Vimeo embeds. Photos may come from any https address until PHOTO_HOSTS is set.
// 'unsafe-inline' scripts: Next writes small inline scripts; a nonce needs every page to render per request.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://cyberjapandata.gsi.go.jp https://maps.gsi.go.jp https://nominatim.openstreetmap.org https://*.wikipedia.org https://commons.wikimedia.org https://*.tile.opentopomap.org${isProd ? "" : " ws: http://localhost:*"}`,
  "worker-src 'self' blob:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;

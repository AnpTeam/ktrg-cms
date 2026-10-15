import type { NextConfig } from "next";
import { linguiMacroSwcPlugin } from "@lingui/swc-plugin/options";

// The Elysia API is proxied under /api/v1 so session cookies stay same-origin.
// Baked in at build time (standalone output): set API_ORIGIN when building.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

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
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;

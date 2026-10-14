import type { NextConfig } from "next";

// The Elysia API is proxied under /api/v1 so session cookies stay same-origin.
// Baked in at build time (standalone output): set API_ORIGIN when building.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone", // apps/web/Dockerfile copies .next/standalone
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;

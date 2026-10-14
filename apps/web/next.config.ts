import type { NextConfig } from "next";

// The Elysia API is proxied under /api so session cookies stay same-origin.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone", // apps/web/Dockerfile copies .next/standalone
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;

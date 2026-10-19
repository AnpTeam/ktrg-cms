/** The site's public address (no trailing slash), for the sitemap and robots.txt. Set SITE_URL in production. */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

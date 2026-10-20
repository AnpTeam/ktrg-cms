import type { MetadataRoute } from "next";
import { listRoutes } from "@/lib/content";
import { siteOrigin } from "@/lib/site";

// The pages a search engine may list: the home page, the routes, and the help and legal pages.
// One address per page: the language follows the visitor, not the address.
// Pages for one person (stamps, profile, login, settings) are left out.
const PAGES = ["", "/map", "/routes", "/sitemap", "/guide", "/faq", "/licenses", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const routes = await listRoutes();
  const paths = [...PAGES, ...routes.map((r) => `/routes/${r.id}`)];
  return paths.map((path) => ({ url: `${origin}${path}` }));
}

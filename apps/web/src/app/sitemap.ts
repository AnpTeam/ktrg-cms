import type { MetadataRoute } from "next";
import { listRoutes } from "@/lib/content";
import { locales } from "@/i18n/locales";
import { siteOrigin } from "@/lib/site";

// The pages a search engine may list: the home page, the routes, and the help and legal pages, each in both
// languages with links between the two. Pages for one person (stamps, profile, login, settings) are left out.
const PAGES = ["", "/routes", "/sitemap", "/guide", "/faq", "/licenses", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const routes = await listRoutes();
  const paths = [...PAGES, ...routes.map((r) => `/routes/${r.id}`)];

  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${origin}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${origin}/${l}${path}`])) },
    })),
  );
}
